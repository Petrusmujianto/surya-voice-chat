const socket = io();
let localStream = null;
let myUsername = "";
let currentRoomId = "";

// Menerima pembaharuan daftar room aktif dari server secara real-time
socket.on('available-rooms', (activeRooms) => {
    const lobbyList = document.getElementById('lobby-room-list');
    
    if (activeRooms.length === 0) {
        lobbyList.innerHTML = `<p style="color: #888; font-size: 13px;">Belum ada room aktif. Jadilah yang pertama membuat room!</p>`;
        return;
    }

    lobbyList.innerHTML = "";
    activeRooms.forEach(room => {
        const card = document.createElement('div');
        card.className = "room-card";
        card.onclick = () => quickJoin(room.name);

        card.innerHTML = `
            <div class="room-info">
                <h4>🎉 Room: ${room.name}</h4>
                <span>👥 ${room.userCount} Orang Berpartisipasi</span>
            </div>
            <button class="btn-join-fast">Gabung</button>
        `;
        lobbyList.appendChild(card);
    });
});

// Fungsi otomatis mengisi nama room ketika kartu di halaman utama di-klik
function quickJoin(targetRoomName) {
    const username = document.getElementById('username-input').value;
    if (!username) return alert("Masukkan Nama Panggilan Anda terlebih dahulu di atas!");
    
    document.getElementById('room-input').value = targetRoomName;
    joinChatroom();
}

// Fungsi utama memproses masuk ke ruang obrolan
function joinChatroom() {
    myUsername = document.getElementById('username-input').value;
    currentRoomId = document.getElementById('room-input').value;

    if (!myUsername || !currentRoomId) return alert("Harap isi Nama dan Nama Room!");

    document.getElementById('setup-box').style.display = 'none';
    document.getElementById('room-box').style.display = 'block';
    document.getElementById('room-title').innerText = `Surya VoiceChat: ${currentRoomId}`;

    // Meminta izin dan mengaktifkan perangkat mikrofon HP
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        localStream = stream;
        socket.emit('join-room', { roomId: currentRoomId, username: myUsername });
    }).catch(err => {
        alert("Aplikasi membutuhkan izin mikrofon untuk dapat mendengarkan suara.");
    });
}

// Memproses visualisasi data kursi pembicara dan penonton dari server
socket.on('room-data', (roomData) => {
    const container = document.getElementById('seats-container');
    container.innerHTML = "";
    let amIOnSeat = false;
    
    roomData.seats.forEach((seat, index) => {
        const seatEl = document.createElement('div');
        if (seat === null) {
            seatEl.className = "seat";
            seatEl.innerText = `Mic ${index + 1}`;
            seatEl.onclick = () => socket.emit('take-seat', { seatIndex: index });
        } else {
            seatEl.className = "seat occupied";
            seatEl.innerText = seat.username;
            if (seat.username === myUsername) amIOnSeat = true;
        }
        container.appendChild(seatEl);
    });

    document.getElementById('btn-leave-seat').style.display = amIOnSeat ? 'inline-block' : 'none';

    // Menghitung jumlah penonton di luar 8 kursi utama
    let audienceCount = roomData.users.length - roomData.seats.filter(s => s !== null).length;
    document.getElementById('audience-count').innerText = audienceCount >= 0 ? audienceCount : 0;
});

// Mengirimkan pesan chat teks
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (input.value.trim() !== "") {
        socket.emit('send-chat', input.value);
        input.value = "";
    }
}

// Menerima dan merender pesan chat baru dari server
socket.on('new-chat-message', (data) => {
    const chatMessages = document.getElementById('chat-messages');
    const msgEl = document.createElement('p');
    msgEl.style.margin = "4px 0";
    msgEl.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Turun dari kursi mic
function leaveSeat() {
    socket.emit('leave-seat');
}

// Logika pemicu WebRTC peer-to-peer suara
socket.on('user-wants-to-talk', (userId) => {
    console.log(`User ${userId} mengaktifkan mic. Proses pertukaran data WebRTC.`);
});
