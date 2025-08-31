document.addEventListener('DOMContentLoaded', () => {
    // Chat elements
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatContainer = document.getElementById('chat-container');

    // Widget elements
    const chatWindow = document.getElementById('chat-window');
    const chatToggle = document.getElementById('chat-toggle');
    const closeChat = document.getElementById('close-chat');

    // Store the conversation history
    let chatHistory = [];

    // --- Widget Toggle Listeners ---
    chatToggle.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        chatToggle.classList.add('hidden');
    });

    closeChat.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
        chatToggle.classList.remove('hidden');
    });


    // --- Core Chat Event Listener ---
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = messageInput.value.trim();
        if (!query) return;

        // Display user's message
        appendMessage('human', query);
        chatHistory.push({ type: 'human', content: query });
        messageInput.value = '';

        // Handle API call and response
        await handleQuery(query);
    });

    // --- Core Functions ---
    async function handleQuery(query) {
        toggleLoading(true);
        showLoadingIndicator();

        try {
            const response = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, history: chatHistory.slice(0, -1) }) // Send history *before* the current question
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();

            // Display AI's answer
            hideLoadingIndicator();
            appendMessage('ai', data.answer);
            chatHistory.push({ type: 'ai', content: data.answer });

        } catch (error) {
            console.error(error);
            hideLoadingIndicator();
            appendMessage('ai', 'Sorry, I encountered an error. Please try again.');
        } finally {
            toggleLoading(false);
        }
    }

    // --- DOM Manipulation Functions ---
    function appendMessage(sender, text) {
        const isAI = sender === 'ai';
        const senderName = isAI ? 'AI' : 'You';
        const senderColor = isAI ? 'bg-indigo-600' : 'bg-sky-600';
        const messageAlign = isAI ? 'items-start' : 'items-end';
        const messageBubbleAlign = isAI ? '' : 'order-last';
        const messageBubbleColor = isAI ? 'bg-slate-800' : 'bg-sky-700';

        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex flex-col ${messageAlign} mb-6`;
        
        const messageHTML = `
            <div class="flex items-start gap-3">
                <div class="${senderColor} text-white p-2 rounded-full h-8 w-8 flex-shrink-0 flex items-center justify-center ${messageBubbleAlign}">${senderName}</div>
                <div class="${messageBubbleColor} rounded-lg p-3 max-w-xl">
                    <p>${text.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `;

        messageWrapper.innerHTML = messageHTML;
        chatContainer.appendChild(messageWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to bottom
    }

    function showLoadingIndicator() {
        const loadingWrapper = document.createElement('div');
        loadingWrapper.id = 'loading-indicator';
        loadingWrapper.className = 'flex items-start gap-3 mb-6';
        loadingWrapper.innerHTML = `
            <div class="bg-indigo-600 text-white p-2 rounded-full h-8 w-8 flex-shrink-0 flex items-center justify-center">AI</div>
            <div class="bg-slate-800 rounded-lg p-3 max-w-xl flex items-center space-x-1.5">
                <span class="block w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span class="block w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span class="block w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
            </div>
        `;
        chatContainer.appendChild(loadingWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function toggleLoading(isLoading) {
        messageInput.disabled = isLoading;
        sendButton.disabled = isLoading;
        if (isLoading) {
            sendButton.textContent = '...';
        } else {
            sendButton.textContent = 'Send';
        }
    }
    
    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});

