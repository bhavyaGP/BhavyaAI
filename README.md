# BhavyaAI Chatbot

A modern, feature-rich AI chatbot interface built with React, TypeScript, and Express.js, powered by Google's Gemini AI and Pinecone vector database.

## 🚀 Features

### Core Features
- **Intelligent Conversations**: Powered by Google Gemini 2.5 Flash for natural language understanding
- **Vector Search**: Uses Pinecone for semantic search and context retrieval
- **Memory Management**: Maintains conversation history for contextual responses
- **Beautiful UI**: Modern, responsive design with dark/light theme support

### New Command Features
- **@reset** - Clear conversation history and start fresh
- **@summarize** - Get a concise summary of your conversation
- **@explain [topic]** - Get detailed explanations of any topic

### Enhanced UI Features
- **Command Helper**: Real-time command suggestions and documentation
- **Typing Indicator**: Visual feedback when the AI is processing
- **Quick Command Panel**: Easy access to commands when chatting
- **Command Highlighting**: Special styling for command messages
- **Responsive Design**: Works perfectly on desktop and mobile
- **Smooth Animations**: Polished transitions and interactions

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Lucide React** for icons
- **Axios** for API communication

### Backend
- **Node.js** with Express.js
- **Google Generative AI** (Gemini)
- **Pinecone** vector database
- **CORS** for cross-origin requests
- **Morgan** for logging

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Google Gemini API key
- Pinecone API key

### Frontend Setup
```bash
cd project
npm install
npm run dev
```

### Backend Setup
```bash
cd server
npm install

# Create .env file with your API keys
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
indexName=your_pinecone_index_name

node app.js
```

## 🎯 Usage

### Basic Chat
1. Type your message in the input field
2. Press Enter or click the send button
3. Wait for BhavyaAI to respond

### Commands
- **@reset**: Clear conversation history
  ```
  @reset
  ```

- **@summarize**: Get conversation summary
  ```
  @summarize
  ```

- **@explain**: Get detailed explanation
  ```
  @explain artificial intelligence
  @explain machine learning algorithms
  @explain react hooks
  ```

### Quick Commands
- Use the command buttons in the header for quick access
- Click command buttons in the welcome screen
- Use the floating command panel during conversations

## 🎨 UI Features

### Command Interface
- **Command Detection**: Input field changes appearance when typing commands
- **Live Help**: Command documentation appears while typing
- **Visual Feedback**: Commands have special styling and icons
- **Quick Access**: Multiple ways to access commands

### Enhanced Experience
- **Smooth Animations**: All interactions are animated
- **Theme Support**: Dark and light mode
- **Responsive Layout**: Works on all screen sizes
- **Accessibility**: Keyboard navigation and screen reader support

## 🔧 Configuration

### Environment Variables
```env
# Backend (.env in server folder)
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
indexName=your_pinecone_index_name
PORT=3003
```

### API Endpoints
- `POST /ask` - Send a question or command
- `GET /` - Health check

### Request Format
```json
{
  "question": "your question or @command",
  "userId": "optional_user_id"
}
```

## 🚀 Deployment

### Frontend (Vite)
```bash
npm run build
npm run preview
```

### Backend (Node.js)
```bash
# Production mode
NODE_ENV=production node app.js
```

## 📱 Mobile Support

The interface is fully responsive and optimized for:
- ✅ Mobile phones
- ✅ Tablets
- ✅ Desktop computers
- ✅ Touch interactions
- ✅ Keyboard navigation

## 🎉 New Features Summary

### Commands
1. **@reset** - Memory management
2. **@summarize** - Conversation summary
3. **@explain** - Topic explanations

### UI Improvements
1. **Command Helper Panel** - Real-time guidance
2. **Typing Indicator** - Better feedback
3. **Quick Command Buttons** - Easy access
4. **Enhanced Animations** - Smooth interactions
5. **Command Styling** - Visual differentiation
6. **Responsive Design** - All device support

## 🔮 Future Enhancements

- Voice input/output
- File upload support
- Multi-language support
- Custom commands
- Conversation export
- Integration with external APIs

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For support or questions, please open an issue in the repository.

---

Built with ❤️ using modern web technologies
