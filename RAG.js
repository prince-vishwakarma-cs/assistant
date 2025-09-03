// RAG.js

import { config } from "dotenv";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import path from "path";
import { ChatGroq } from "@langchain/groq";

config();

class RAGSystem {
  constructor() {
    this.llm = new ChatGroq({
      model: "llama-3.1-8b-instant",
      apiKey: process.env.GROQ_API_KEY,
      temperature: 0.2,
    });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "text-embedding-004",
    });

    this.supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    this.vectorStore = null;
    this.retriever = null;
    this.chain = null;
  }

  async ingestData(filePath) {
    try {
      console.log("Starting data ingestion...");
      const documents = await this.loadData(filePath);
      console.log(`Loaded ${documents.length} documents`);
      const chunks = await this.textSplitter.splitDocuments(documents);
      console.log(`Split into ${chunks.length} chunks`);
      await this.storeInVectorDatabase(chunks);
      console.log("Data ingestion completed successfully!");
    } catch (error) {
      console.error("Error during ingestion:", error);
      throw error;
    }
  }

  async loadData(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    let loader;
    switch (extension) {
      case ".pdf":
        loader = new PDFLoader(filePath);
        break;
      case ".txt":
        loader = new TextLoader(filePath);
        break;
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
    return await loader.load();
  }

  async storeInVectorDatabase(chunks) {
    try {
      this.vectorStore = await SupabaseVectorStore.fromDocuments(
        chunks,
        this.embeddings,
        {
          client: this.supabaseClient,
          tableName: "documents",
          queryName: "match_documents",
        }
      );
      this.retriever = this.vectorStore.asRetriever({ k: 2 });
      console.log("Documents stored in vector database");
    } catch (error) {
      console.error("Error storing in vector database :", error);
      throw error;
    }
  }

  async initialize() {
    console.log("Initializing RAG System...");

    const vectorStore = new SupabaseVectorStore(this.embeddings, {
      client: this.supabaseClient,
      tableName: "documents",
      queryName: "match_documents",
    });
    this.retriever = vectorStore.asRetriever({ k: 3 });
    console.log("Retriever initialized from Supabase.");

    const historyAwarePrompt = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
      [
        "user",
        "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation",
      ],
    ]);

    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
      llm: this.llm,
      retriever: this.retriever,
      rephrasePrompt: historyAwarePrompt,
    });
    const historyAwareAnswerPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "Answer the user's questions based on the below context:\n\n{context}",
      ],
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
    ]);
    const combineDocsChain = await createStuffDocumentsChain({
      llm: this.llm,
      prompt: historyAwareAnswerPrompt,
    });

    this.chain = await createRetrievalChain({
      retriever: historyAwareRetrieverChain,
      combineDocsChain,
    });

    console.log("RAG System is fully initialized and ready.");
  }

  async query(question, chat_history = []) {
    if (!this.chain) {
      throw new Error(
        "RAGSystem not initialized. Please call initialize() before querying."
      );
    }

    try {
      console.log(`Processing question: ${question}`);

      // 1. Change .invoke() to .stream()
      const stream = await this.chain.stream({
        chat_history,
        input: question,
      });

      // 2. Return the stream object directly
      return stream;
    } catch (error) {
      console.error("Error during query:", error);
      throw error;
    }
  }
}

export { RAGSystem };
