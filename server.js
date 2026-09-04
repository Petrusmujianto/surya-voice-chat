const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');

// Menyediakan akses file statik dari folder utama dan folder public
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Mengarahkan halaman utama langsung ke file index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    });
});

// Penyimpanan data sementara untuk Room & Kursi Mic
const rooms = {};

// Fungsi untuk mendapatkan daftar room yang sedang aktif dan ada penggunanya
function getActiveRooms() {
    const activeRooms = [];
    for (const roomId in rooms) {
        if (rooms[roomId].users.length > 0) {
            activeRooms.push({
                id: roomId,
                name: roomId,
                userCount: rooms[roomId].users.length
            });
        }
    }
    return activeRooms;
}

io.on('connection', (socket) => {
    let currentRoom = null;
    let userId = null;
    let myUsername = "";

    // Kirim daftar room aktif saat pertama kali user membuka aplikasi
    socket.emit('available-rooms', getActiveRooms());

    // Event saat pengguna masuk ke Room
    socket.on('join-room', ({ roomId, username }) => {
        currentRoom = roomId;
        userId = socket.id;
        myUsername = username;
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                users: [],
                seats: Array(8).fill(null) 
            };
        }

        rooms[roomId].users.push({ id: userId, username });
        socket.join(roomId);

        // Perbarui data room dan kirim ke seluruh user di room tersebut
        io.to(roomId).emit('room-data', rooms[roomId]);
        
        // Perbarui daftar room di halaman depan (Lobby global)
        io.emit('available-rooms', getActiveRooms());

        io.to(roomId).emit('new-chat-message', {
            username: 'Sistem',
            message: `${username} bergabung ke Surya VoiceChat!`
        });
    });

    // Event mengirim pesan Live Chat teks
    socket.on('send-chat', (message) => {
        if (!currentRoom) return;
        io.to(currentRoom).emit('new-chat-message', {
            username: myUsername,
            message: message
        });
    });

    // Event meminta naik ke Kursi Mic
    socket.on('take-seat', ({ seatIndex }) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        
        // Cek jika kursi yang dipilih kosong
        if (rooms[currentRoom].seats[seatIndex] === null) {
            // Kosongkan kursi lama jika sebelumnya user sudah menduduki kursi lain
            const oldSeat = rooms[currentRoom].seats.findIndex(s => s && s.id === userId);
            if (oldSeat !== -1) rooms[currentRoom].seats[oldSeat] = null;

            rooms[currentRoom].seats[seatIndex] = { id: userId, username: myUsername };
            
            io.to(currentRoom).emit('room-data', rooms[currentRoom]);
            socket.to(currentRoom).emit('user-wants-to-talk', userId);
        }
    });

    // Event turun dari Kursi Mic
    socket.on('leave-seat', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const seatIndex = rooms[currentRoom].seats.findIndex(s => s && s.id === userId);
        
        if (seatIndex !== -1) {
            rooms[currentRoom].seats[seatIndex] = null;
            io.to(currentRoom).emit('room-data', rooms[currentRoom]);
            socket.to(currentRoom).emit('user-stopped-talking', userId);
        }
    });

    // Event saat pengguna keluar / disconnect dari aplikasi
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].users = rooms[currentRoom].users.filter(u => u.id !== userId);
            const seatIndex = rooms[currentRoom].seats.findIndex(s => s && s.id === userId);
            if (seatIndex !== -1) rooms[currentRoom].seats[seatIndex] = null;

            io.to(currentRoom).emit('room-data', rooms[currentRoom]);

            // Hapus room dari memori server jika sudah kosong
            if (rooms[currentRoom].users.length === 0) {
                delete rooms[currentRoom];
            }

            io.emit('available-rooms', getActiveRooms());
        }
    });
});

// Menentukan Port secara dinamis untuk Cloud Hosting
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server Surya VoiceChat berjalan secara global pada port ${PORT}`);
});
