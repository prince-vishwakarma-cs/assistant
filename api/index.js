import express from "express";
import cors from "cors";
import { RAGSystem } from "../RAG.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
const app = express();

const allowedOrigins = [
  process.env.FRONTEND_BASE_URL, 
  "http://127.0.0.1:5500",        
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

const requestLogger = (req, res, next) => {
  const origin = req.headers.origin || 'N/A (e.g., Postman, server-side)';
  console.log(`[REQUEST] --> ${req.method} ${req.originalUrl} from ${origin}`);
  console.log(process.env.FRONTEND_BASE_URL)
  next();
};

app.use(requestLogger)
app.use(cors(corsOptions));

app.use(express.json());

const ragSystem = new RAGSystem();



app.post("/api/query", async (req, res) => {
  try {
    const { query, history } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const chat_history = (history || [])
    .map((msg) => {
      if (msg.type === "human") return new HumanMessage(msg.content);
        if (msg.type === "ai") return new AIMessage(msg.content);
        return null;
      })
      .filter(Boolean);

    const response = await ragSystem.query(query, chat_history);
    res.status(200).json(response);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "An internal server error occurred" });
  }
});

app.get("/api", (req, res) => {
    res.status(200).json({ message: "Welcome to the RAG API. The server is running." });
});

app.get("/", (req, res) => res.status(200).json({
    message: "Server is working fine on Vercel"
}));


app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  res.status(500).json({
    error: "Internal server error",
  });
});

export default app;
