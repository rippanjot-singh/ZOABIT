require('dotenv').config();
const app = require('./src/app');
const {connectDB} = require('./src/config/db');
const http = require('http');
const { Server } = require('socket.io');

connectDB();

const PORT = process.env.PORT || 3000;

// Create an HTTP server wrapping the Express app
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings mirroring your Express config
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }
});

// Optionally attach the io instance to the app so you can use it in routes/controllers via `req.app.get('io')`
app.set('io', io);

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log('A user connected via socket:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Listen on the HTTP server instead of the Express app directly
server.listen(PORT, () => {
  console.log('Server is running on port: ' + PORT);
});