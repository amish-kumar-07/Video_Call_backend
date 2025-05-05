const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Set up CORS for Express
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
}));

// Create Socket.IO server with CORS settings
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle room joining
  socket.on('join-room', (roomId) => {
    console.log(`User ${socket.id} joining room: ${roomId}`);
    
    // Get room info to check if it's full
    const roomUsers = io.sockets.adapter.rooms.get(roomId);
    const numUsers = roomUsers ? roomUsers.size : 0;
    
    // Limit room to 2 participants
    if (numUsers >= 2) {
      socket.emit('room-full');
      return;
    }
    
    // Join the room
    socket.join(roomId);
    socket.roomId = roomId;
    
    // Inform user they've joined
    socket.emit('joined-room', { roomId, userId: socket.id });
    
    // If there's someone else in the room, inform them
    if (numUsers > 0) {
      // Notify the new user that they should initiate the WebRTC connection
      socket.emit('initiate-connection');
      
      // Notify other users in the room
      socket.to(roomId).emit('user-connected', socket.id);
    }
  });
  
  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    console.log(`Offer from ${socket.id} to room ${socket.roomId}`);
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      userId: socket.id
    });
  });
  
  socket.on('answer', (data) => {
    console.log(`Answer from ${socket.id} to room ${socket.roomId}`);
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      userId: socket.id
    });
  });
  
  socket.on('ice-candidate', (data) => {
    console.log(`ICE candidate from ${socket.id}`);
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      userId: socket.id
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // If user was in a room, notify others
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    }
  });
});

// Simple health check route
app.get('/', (req, res) => {
  res.send('WebRTC Signaling Server is running');
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});