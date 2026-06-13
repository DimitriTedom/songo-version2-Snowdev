// sNOWdEV TEDOM TAFOTSI DMITRI WILFRIED 23v2180
const API_URL = "api.php";
const POLL_INTERVAL = 2000; 

const clickSound = new Audio("./click.mp3");
clickSound.volume = 0.5; 

let gameId = null;
let token = null;   
let myPlayer = null; 

let pits = [];
let captured = [0, 0];
let currentPlayer = 0;
let gameStatus = "waiting"; 

const loginScreen = document.getElementById("loginScreen");
const gameScreen = document.getElementById("gameScreen");
const turnInfo = document.getElementById("turnInfo");
const score0Span = document.getElementById("score0");
const score1Span = document.getElementById("score1");
const statusMessage = document.getElementById("statusMessage");
const row0 = document.getElementById("row0");
const row1 = document.getElementById("row1");

// Requête AJAX avec XMLHttpRequest
function ajaxRequest(method, url, body) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        if (method === "POST") {
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        }
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== XMLHttpRequest.DONE) return;
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(e);
                }
            } else {
                reject(new Error("HTTP " + xhr.status));
            }
        };
        xhr.onerror = function () {
            reject(new Error("Erreur réseau"));
        };
        xhr.send(body || null);
    });
}

// Boutons
document.getElementById("btnNewGame").addEventListener("click", createGame);
document.getElementById("btnJoinGame").addEventListener("click", joinGame);
document.getElementById("btnStartPlaying").addEventListener("click", startPlaying);
document.getElementById("btnQuit").addEventListener("click", quitGame);

// Créer une nouvelle partie
async function createGame() {
    const data = await ajaxRequest("POST", API_URL, "action=new");
    if (data.error) {
        alert(data.error);
        return;
    }
    gameId = data.game_id;
    token = data.token;
    myPlayer = 0; 
    document.getElementById("gameIdDisplay").textContent = gameId;
    document.getElementById("newGameInfo").style.display = "block";
    document.getElementById("btnNewGame").disabled = true;
    document.getElementById("btnJoinGame").disabled = true;
}

// Commencer à jouer (passer à l'écran de jeu, même si l'adversaire n'a pas encore rejoint)
function startPlaying() {
    loginScreen.style.display = "none";
    gameScreen.style.display = "block";
    startPolling();
}

// Rejoindre une partie existante
async function joinGame() {
    const joinId = document.getElementById("joinGameId").value.trim();
    if (!joinId) {
        document.getElementById("joinError").textContent = "Veuillez entrer un ID";
        return;
    }
    const data = await ajaxRequest("POST", API_URL, `action=join&game_id=${encodeURIComponent(joinId)}`);
    if (data.error) {
        document.getElementById("joinError").textContent = data.error;
        return;
    }
    gameId = data.game_id;
    token = data.token;
    myPlayer = data.player; 
    loginScreen.style.display = "none";
    gameScreen.style.display = "block";
    document.getElementById("joinError").textContent = "";
    startPolling();
}

// Quitter la partie et revenir à l'écran d'accueil
function quitGame() {
    stopPolling();
    gameId = null;
    token = null;
    myPlayer = null;
    gameScreen.style.display = "none";
    loginScreen.style.display = "block";

    document.getElementById("btnNewGame").disabled = false;
    document.getElementById("btnJoinGame").disabled = false;
    document.getElementById("newGameInfo").style.display = "none";
    document.getElementById("joinGameId").value = "";
}

// Polling périodique pour récupérer l'état du jeu
let pollTimer = null;
function startPolling() {
    fetchState(); 
    pollTimer = setInterval(fetchState, POLL_INTERVAL);
}
function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

async function fetchState() {
    if (!gameId || !token) return;
    try {
        const data = await ajaxRequest("GET", `${API_URL}?action=state&game_id=${encodeURIComponent(gameId)}&token=${encodeURIComponent(token)}`);
        if (data.error) {
            statusMessage.textContent = data.error;
            return;
        }
        updateGameState(data);
    } catch (e) {
        console.error("Erreur fetch state", e);
    }
}

// Met à jour l'affichage à partir des données reçues du serveur
function updateGameState(data) {
    pits = data.pits;
    captured = data.captured;
    currentPlayer = data.currentPlayer;
    gameStatus = data.status;

    score0Span.textContent = captured[0];
    score1Span.textContent = captured[1];

    if (gameStatus === "waiting") {
        turnInfo.textContent = "En attente de l'adversaire...";
        statusMessage.textContent = myPlayer === 0 ? "Vous êtes le Joueur 1 (haut)." : "Vous êtes le Joueur 2 (bas).";
        renderBoard(true); 
        return;
    }

    if (gameStatus === "finished") {
        let msg = "";
        if (captured[0] > 35) msg = "Joueur 1 gagne !";
        else if (captured[1] > 35) msg = "Joueur 2 gagne !";
        else if (pits.slice(0,7).every(v => v === 0)) msg = "Joueur 2 gagne (Joueur 1 ne peut plus jouer)";
        else if (pits.slice(7,14).every(v => v === 0)) msg = "Joueur 1 gagne (Joueur 2 ne peut plus jouer)";
        else msg = "Partie terminée";
        turnInfo.textContent = msg;
        statusMessage.textContent = "";
        renderBoard(false);
        stopPolling();
        return;
    }

    // Partie en cours
    const isMyTurn = (currentPlayer === myPlayer);
    turnInfo.textContent = isMyTurn ? "C'est à vous de jouer !" : "Tour de l'adversaire...";
    statusMessage.textContent = `Vous êtes le Joueur ${myPlayer+1} (${myPlayer===0?"haut":"bas"})`;
    renderBoard(isMyTurn);
}

// Affichage du plateau
function renderBoard(clickable) {
    row0.innerHTML = "";
    row1.innerHTML = "";
    for (let i = 0; i < 7; i++) {
        // Rangée du haut (indices 0 à 6)
        const pitDiv = createPitElement(i, 0, clickable);
        row0.appendChild(pitDiv);
        // Rangée du bas (indices 13 à 7)
        const bottomIndex = 13 - i;
        const pitDiv2 = createPitElement(bottomIndex, 1, clickable);
        row1.appendChild(pitDiv2);
    }
}

// Affichage simple du plateau (sans écouteurs, pour l'animation)
function renderBoardSimple() {
    row0.innerHTML = "";
    row1.innerHTML = "";
    for (let i = 0; i < 7; i++) {
        // Rangée du haut (indices 0 à 6)
        const pitDiv = document.createElement("div");
        pitDiv.className = "pit";
        pitDiv.dataset.index = i;
        pitDiv.textContent = pits[i];
        if (pits[i] === 0) pitDiv.classList.add("empty");
        pitDiv.classList.add("disabled");
        row0.appendChild(pitDiv);
        
        // Rangée du bas (indices 13 à 7)
        const bottomIndex = 13 - i;
        const pitDiv2 = document.createElement("div");
        pitDiv2.className = "pit";
        pitDiv2.dataset.index = bottomIndex;
        pitDiv2.textContent = pits[bottomIndex];
        if (pits[bottomIndex] === 0) pitDiv2.classList.add("empty");
        pitDiv2.classList.add("disabled");
        row1.appendChild(pitDiv2);
    }
}

function createPitElement(index, playerRow, clickable) {
    const div = document.createElement("div");
    div.className = "pit";
    div.dataset.index = index;
    div.textContent = pits[index];
    if (pits[index] === 0) div.classList.add("empty");

    const isMyRow = (playerRow === myPlayer);
    const isCurrentPlayerRow = (playerRow === currentPlayer);
    const canClick = clickable && isMyRow && isCurrentPlayerRow && pits[index] > 0 && gameStatus === "playing";

    if (canClick) {
        div.classList.add("active");
        div.addEventListener("click", () => handlePitClick(index));
    } else {
        div.classList.add("disabled");
    }

    return div;
}

// Envoi d'un coup au serveur
async function handlePitClick(index) {
    if (currentPlayer !== myPlayer) return;
    if (pits[index] <= 0) return;

    // Désactiver les clics pendant l'animation
    renderBoard(false);

    const data = await ajaxRequest("POST", API_URL, `action=move&game_id=${encodeURIComponent(gameId)}&token=${encodeURIComponent(token)}&index=${index}`);
    if (data.error) {
        statusMessage.textContent = data.error;
        // Réactiver les clics si c'était notre tour
        if (currentPlayer === myPlayer) renderBoard(true);
        return;
    }

    // Si le serveur a renvoyé un chemin de semis, on anime
    if (data.sown_path && data.sown_path.length > 0) {
        // On part de l'état actuel avec la case de départ vidée
        const startPits = [...pits];
        startPits[index] = 0;
        
        await animateSowing(startPits, data.sown_path, data.capture_index, data);
    } else {
        // Pas de chemin, on met à jour directement
        updateGameState(data);
    }
}

// Fonction d'animation : déposer les graines une par une
async function animateSowing(startPits, sownPath, captureIndex, finalState) {
    // Créer une copie de l'état de départ (case cliquée déjà vidée)
    let currentPits = [...startPits];
    
    for (let i = 0; i < sownPath.length; i++) {
        const targetIndex = sownPath[i];
        
        currentPits[targetIndex]++;
        
        clickSound.currentTime = 0; // Revenir au début du son
        clickSound.play().catch(e => console.log("Son ignoré:", e));
        
        pits = currentPits;
        renderBoardSimple();
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Animation terminée, appliquer l'état final (avec capture si nécessaire)
    updateGameState(finalState);
}

resetGame();

