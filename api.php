<?php
// api.php – Gestion du jeu Songo en réseau
header('Content-Type: application/json');

// Dossier de stockage des parties (doit être accessible en écriture)
define('GAMES_DIR', __DIR__ . '/games/');

// Fonctions utilitaires de verrouillage de fichier
function loadGame($gameId) {
    $file = GAMES_DIR . 'game_' . basename($gameId) . '.json';
    if (!file_exists($file)) return null;
    $fp = fopen($file, 'r');
    if (flock($fp, LOCK_SH)) {
        $json = fread($fp, filesize($file));
        flock($fp, LOCK_UN);
        fclose($fp);
        return json_decode($json, true);
    }
    fclose($fp);
    return null;
}

function saveGame($gameId, $data) {
    $file = GAMES_DIR . 'game_' . basename($gameId) . '.json';
    $fp = fopen($file, 'w');
    if (flock($fp, LOCK_EX)) {
        fwrite($fp, json_encode($data));
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
    }
    fclose($fp);
    return false;
}

// Génère un token aléatoire
function generateToken() {
    return bin2hex(random_bytes(16));
}

// Récupère les paramètres
$action = $_REQUEST['action'] ?? '';

// --- Action : créer une nouvelle partie ---
if ($action === 'new') {
    $gameId = uniqid('songo_', true);
    $token1 = generateToken();
    $initialState = [
        'pits' => array_fill(0, 14, 5),
        'captured' => [0, 0],
        'currentPlayer' => 0,
        'status' => 'waiting', // en attente du joueur 2
        'tokens' => [
            'player0' => $token1,
            'player1' => null   // pas encore défini
        ]
    ];
    if (saveGame($gameId, $initialState)) {
        echo json_encode([
            'game_id' => $gameId,
            'token' => $token1
        ]);
    } else {
        echo json_encode(['error' => 'Erreur serveur']);
    }
    exit;
}

// --- Action : rejoindre une partie existante ---
if ($action === 'join') {
    $gameId = $_POST['game_id'] ?? '';
    if (empty($gameId)) {
        echo json_encode(['error' => 'ID de partie manquant']);
        exit;
    }
    $game = loadGame($gameId);
    if (!$game) {
        echo json_encode(['error' => 'Partie introuvable']);
        exit;
    }
    if ($game['tokens']['player1'] !== null) {
        echo json_encode(['error' => 'Partie déjà complète']);
        exit;
    }
    // Le joueur 2 rejoint
    $token2 = generateToken();
    $game['tokens']['player1'] = $token2;
    $game['status'] = 'playing'; // la partie peut commencer
    if (saveGame($gameId, $game)) {
        echo json_encode([
            'game_id' => $gameId,
            'token' => $token2,
            'player' => 1   // joueur 2 (bas)
        ]);
    } else {
        echo json_encode(['error' => 'Erreur serveur']);
    }
    exit;
}

// --- Action : récupérer l'état de la partie ---
if ($action === 'state') {
    $gameId = $_GET['game_id'] ?? '';
    $token = $_GET['token'] ?? '';
    if (empty($gameId) || empty($token)) {
        echo json_encode(['error' => 'Paramètres manquants']);
        exit;
    }
    $game = loadGame($gameId);
    if (!$game) {
        echo json_encode(['error' => 'Partie introuvable']);
        exit;
    }
    // Vérification du token
    $player = null;
    if ($game['tokens']['player0'] === $token) {
        $player = 0;
    } elseif ($game['tokens']['player1'] === $token) {
        $player = 1;
    } else {
        echo json_encode(['error' => 'Token invalide']);
        exit;
    }
    // On renvoie l'état (sans les tokens)
    $response = [
        'pits' => $game['pits'],
        'captured' => $game['captured'],
        'currentPlayer' => $game['currentPlayer'],
        'status' => $game['status']
    ];
    echo json_encode($response);
    exit;
}

// --- Action : jouer un coup ---
if ($action === 'move') {
    $gameId = $_POST['game_id'] ?? '';
    $token = $_POST['token'] ?? '';
    $index = isset($_POST['index']) ? intval($_POST['index']) : -1;

    if (empty($gameId) || empty($token) || $index < 0 || $index > 13) {
        echo json_encode(['error' => 'Paramètres invalides']);
        exit;
    }
    $game = loadGame($gameId);
    if (!$game) {
        echo json_encode(['error' => 'Partie introuvable']);
        exit;
    }
    // Vérifier le token et récupérer le numéro du joueur
    $player = null;
    if ($game['tokens']['player0'] === $token) {
        $player = 0;
    } elseif ($game['tokens']['player1'] === $token) {
        $player = 1;
    } else {
        echo json_encode(['error' => 'Token invalide']);
        exit;
    }
    if ($game['status'] !== 'playing') {
        echo json_encode(['error' => 'La partie n\'est pas en cours']);
        exit;
    }
    if ($game['currentPlayer'] !== $player) {
        echo json_encode(['error' => 'Ce n\'est pas votre tour']);
        exit;
    }
    // Vérifier que la case appartient bien au joueur
    $owner = ($index <= 6) ? 0 : 1;
    if ($owner !== $player) {
        echo json_encode(['error' => 'Cette case ne vous appartient pas']);
        exit;
    }
    $pits = $game['pits'];
    if ($pits[$index] === 0) {
        echo json_encode(['error' => 'Case vide']);
        exit;
    }

    // --- Logique de jeu côté serveur ---
    $seeds = $pits[$index];
    $pits[$index] = 0;
    $currentIdx = $index;
    $lastIdx = -1;
    $sownPath = []; // NOUVEAU : va contenir la liste des cases où on dépose

    for ($i = 0; $i < $seeds; $i++) {
        $currentIdx = ($currentIdx + 1) % 14;
        if ($currentIdx === $index) { // sauter la case de départ
            $currentIdx = ($currentIdx + 1) % 14;
        }
        $pits[$currentIdx]++;
        $lastIdx = $currentIdx;
        $sownPath[] = $currentIdx; // NOUVEAU : on enregistre cette case
    }

    // Capture éventuelle
    $lastOwner = ($lastIdx <= 6) ? 0 : 1;
    $captureOccurred = false; // NOUVEAU
    if ($lastOwner !== $player) {
        if ($pits[$lastIdx] > 1) { // signe qu'il y avait déjà des graines
            $game['captured'][$player] += $pits[$lastIdx];
            $pits[$lastIdx] = 0;
            $captureOccurred = true; // NOUVEAU
        }
    }

    // Mettre à jour l'état
    $game['pits'] = $pits;
    // Changement de joueur
    $game['currentPlayer'] = 1 - $player;

    // Vérifications de fin de partie
    $opponent = 1 - $player;
    $opponentHasMoves = false;
    $start = $opponent === 0 ? 0 : 7;
    $end = $opponent === 0 ? 7 : 14;
    for ($i = $start; $i < $end; $i++) {
        if ($pits[$i] > 0) {
            $opponentHasMoves = true;
            break;
        }
    }
    if (!$opponentHasMoves || $game['captured'][$player] > 35) {
        $game['status'] = 'finished';
    }

    if (saveGame($gameId, $game)) {
        // Renvoyer l'état mis à jour (sans les tokens) + chemin de semis
        $response = [
            'pits' => $game['pits'],
            'captured' => $game['captured'],
            'currentPlayer' => $game['currentPlayer'],
            'status' => $game['status'],
            'sown_path' => $sownPath,                          // NOUVEAU
            'capture_index' => $captureOccurred ? $lastIdx : -1 // NOUVEAU
        ];
        echo json_encode($response);
    } else {
        echo json_encode(['error' => 'Erreur serveur lors de la sauvegarde']);
    }
    exit;
}

// Action inconnue
echo json_encode(['error' => 'Action invalide']);

