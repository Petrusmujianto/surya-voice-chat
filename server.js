const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path'); // Tambahkan baris ini di atas

// Hapus atau ganti baris app.use(express.static) lama dengan ini:
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Tambahkan rute penanganan manual ini tepat di bawahnya:
app.get('/', (req, res) => {
    // Kode ini akan otomatis mencari index.html baik di folder utama maupun di dalam folder public
    res.sendFile(path.join(__dirname, 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    });
});

// ... (Sisa kode Socket.io ke bawah tetap sama seperti sebelumnya) ...

// Data Room, Kursi, & Chat Sementara
const rooms = {};

io.on('connection', (socket) => {
    let currentRoom = null;
    let userId = null;
    let myUsername = "";

    // 1. Pengguna masuk ke Surya VoiceChat Room
    socket.on('join-room', ({ roomId, username }) => {
        currentRoom = roomId;
        userId = socket.id;
        myUsername = username;
        
        if (!rooms[roomId]) {
            // Struktur dasar room ala YoYo (8 Kursi Mic)
            rooms[roomId] = {
                users: [],
                seats: Array(8).fill(null) 
            };
        }

        rooms[roomId].users.push({ id: userId, username });
        socket.join(roomId);

        // Kirim info room terbaru & pesan selamat datang
        io.to(roomId).emit('room-data', rooms[roomId]);
        io.to(roomId).emit('new-chat-message', {
            username: 'Sistem',
            message: `${username} bergabung ke Surya VoiceChat!`
        });
    });

    // 2. Fitur Live Chat Teks
    socket.on('send-chat', (message) => {
        if (!currentRoom) return;
        io.to(currentRoom).emit('new-chat-message', {
            username: myUsername,
            message: message
        });
    });

    // 3. Pengguna meminta naik ke Kursi Mic (Take Seat)
    socket.on('take-seat', ({ seatIndex }) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        
        // Pastikan kursi kosong
        if (rooms[currentRoom].seats[seatIndex] === null) {
            // Jika user sudah di kursi lain, kosongkan kursi lamanya
            const oldSeat = rooms[currentRoom].seats.findIndex(s => s && s.id === userId);
            if (oldSeat !== -1) rooms[currentRoom].seats[oldSeat] = null;

            rooms[currentRoom].seats[seatIndex] = { id: userId, username: myUsername };
            
            io.to(currentRoom).emit('room-data', rooms[currentRoom]);
            socket.to(currentRoom).emit('user-wants-to-talk', userId);
        }
    });

    // 4. Pengguna turun dari Kursi Mic
    socket.on('leave-seat', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const seatIndex = rooms[currentRoom].seats.findIndex(s => s && s.id === userId);
        
        if (seatIndex !== -1) {
            rooms[currentRoom].seats[seatIndex] = null;
            io.to(currentRoom).emit('room-data', rooms[currentRoom]);
            socket.to(currentRoom).emit('user-stopped-talking', userId);
        }
    });

    // 5. Penanganan Pengguna Keluar / Putus Koneksi
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].users = rooms[currentRoom].users.filter(u => u.id !== userId);
            const seatIndex = rooms[currentRoom].seats.findIndex(s => s && s.id === userId);
            if (seatIndex !== -1) rooms[currentRoom].seats[seatIndex] = null;

            io.to(currentRoom).emit('room-data', rooms[currentRoom]);
        }
    });
});

// Menggunakan port dinamis dari server hosting, jika tidak ada baru pakai port 3000
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server Surya VoiceChat berjalan secara global pada port ${PORT}`);
});
