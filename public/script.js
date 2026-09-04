const socket = io();
let localStream = null;
let myUsername = "";
let currentRoomId = "";

function joinChatroom() {
    myUsername = document.getElementById('username-input').value;
    currentRoomId = document.getElementById('room-input').value;

    if (!myUsername || !currentRoomId) return alert("Harap isi Nama dan Nama Room!");

    document.getElementById('setup-box').style.display = 'none';
    document.getElementById('room-box').style.display = 'block';
    document.getElementById('room-title').innerText = `Surya VoiceChat: ${currentRoomId}`;

    // Siapkan mikrofon perangkat
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        localStream = stream;
        socket.emit('join-room', { roomId: currentRoomId, username: myUsername });
    }).catch(err => alert("Gagal mengakses mikrofon. Aplikasi membutuhkan izin suara."));
}

// Perbarui Kursi dan Informasi Penonton secara Real-Time
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

    // Kontrol visibilitas tombol turun mic
    document.getElementById('btn-leave-seat').style.display = amIOnSeat ? 'inline-block' : 'none';

    // Hitung penonton diluar kursi mic
    let audienceCount = roomData.users.length - roomData.seats.filter(s => s !== null).length;
    document.getElementById('audience-count').innerText = audienceCount >= 0 ? audienceCount : 0;
});

// Mengirim teks chat
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (input.value.trim() !== "") {
        socket.emit('send-chat', input.value);
        input.value = "";
    }
}

// Menerima teks chat baru
socket.on('new-chat-message', (data) => {
    const chatMessages = document.getElementById('chat-messages');
    const msgEl = document.createElement('p');
    msgEl.style.margin = "4px 0";
    msgEl.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Auto scroll ke bawah
});

function leaveSeat() {
    socket.emit('leave-seat');
}

socket.on('user-wants-to-talk', (userId) => {
    console.log(`Pengguna dengan ID ${userId} naik ke Mic. Handshake WebRTC dipicu.`);
});
