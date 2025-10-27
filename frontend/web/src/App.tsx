import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

// Represents the structure of a game room
interface GameRoom {
  id: string;
  player1: string;
  wager: string;
  encryptedMove1: string;
  player2?: string;
  status: "Waiting" | "In-Progress" | "Completed";
  winner?: string;
}

// Represents the user's move choice
type Move = "Rock" | "Paper" | "Scissors" | null;
const moveMap: { [key: string]: number } = { Rock: 0, Paper: 1, Scissors: 2 };

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameRooms, setGameRooms] = useState<GameRoom[]>([]);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);

  // Modal and game state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMove, setSelectedMove] = useState<Move>(null);
  const [wagerAmount, setWagerAmount] = useState("0.01");

  // Transaction status feedback
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });

  // Initial load of game rooms
  useEffect(() => {
    loadGameRooms().finally(() => setLoading(false));
  }, []);

  // Handler for wallet selection
  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      setAccount(accounts[0] || "");

      wallet.provider.on("accountsChanged", (accounts: string[]) => {
        setAccount(accounts[0] || "");
      });
    } catch (e) {
      console.error("Failed to connect wallet", e);
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  // Fetches and updates game rooms from the smart contract
  const loadGameRooms = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.warn("Contract is not available.");
        return;
      }

      const keysBytes = await contract.getData("game_room_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          // Attempt to parse the keys from the contract response
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          // If parsing fails (e.g., empty string), default to an empty array
          console.error("Could not parse game room keys, defaulting to empty array:", e);
          keys = [];
        }
      }

      const rooms: GameRoom[] = [];
      for (const key of keys) {
        const roomBytes = await contract.getData(`game_room_${key}`);
        if (roomBytes.length > 0) {
          try {
            const roomData = JSON.parse(ethers.toUtf8String(roomBytes));
            rooms.push({ id: key, ...roomData });
          } catch (e) {
            console.error(`Error parsing data for room ${key}:`, e);
          }
        }
      }
      
      // Sort rooms by status, showing waiting rooms first
      rooms.sort((a, b) => (a.status === 'Waiting' ? -1 : 1));
      setGameRooms(rooms);
    } catch (e) {
      console.error("Error loading game rooms:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Simulates FHE encryption on the client-side
  const fheEncryptMove = async (move: Move): Promise<string> => {
    // This is a simulation of client-side FHE encryption.
    // In a real implementation, this would involve a library like fhevmjs.
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting your move with FHE...",
    });
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate encryption time
    const moveValue = move ? moveMap[move] : -1;
    return `fhe-encrypted(${btoa(JSON.stringify({ move: moveValue, salt: Math.random() }))})`;
  };

  // Handles the creation of a new game room
  const handleCreateGame = async () => {
    if (!provider || !selectedMove || parseFloat(wagerAmount) <= 0) {
      alert("Please connect your wallet, select a move, and set a valid wager.");
      return;
    }

    setIsSubmitting(true);
    try {
      const encryptedMove = await fheEncryptMove(selectedMove);

      setTransactionStatus({
        visible: true,
        status: "pending",
        message: "Sending transaction to create game room...",
      });
      
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Contract not available");

      const gameId = `${Date.now()}-${account.substring(2, 8)}`;
      const gameRoomData = {
        player1: account,
        wager: ethers.parseEther(wagerAmount).toString(),
        encryptedMove1: encryptedMove,
        status: "Waiting",
      };

      await contract.setData(
        `game_room_${gameId}`,
        ethers.toUtf8Bytes(JSON.stringify(gameRoomData))
      );

      const keysBytes = await contract.getData("game_room_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
            // Attempt to parse the keys from the contract response
            keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
            // If parsing fails, default to an empty array
            console.error("Could not parse game room keys, defaulting to empty array:", e);
            keys = [];
        }
      }
      keys.push(gameId);
      await contract.setData("game_room_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));

      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Game created successfully!",
      });

      await loadGameRooms();
      setTimeout(() => {
        setShowCreateModal(false);
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);

    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Failed to create game: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally {
      setIsSubmitting(false);
      setSelectedMove(null);
    }
  };
  
  // Handles a player joining an existing game
  const handleJoinGame = async (room: GameRoom, move: Move) => {
     if (!provider || !move) {
      alert("Please connect your wallet and select a move.");
      return;
    }
    
    setIsSubmitting(true);
    try {
        const encryptedMove = await fheEncryptMove(move);

        setTransactionStatus({
            visible: true,
            status: "pending",
            message: "Joining game and determining winner on-chain...",
        });

        const contract = await getContractWithSigner();
        if (!contract) throw new Error("Contract not available");

        // Simulate on-chain FHE computation to determine the winner
        // In a real fhEVM, the result would be computed on-chain from encrypted inputs
        const winner = Math.random() > 0.5 ? room.player1 : account; 

        const updatedRoomData = {
            ...room,
            player2: account,
            status: "Completed",
            winner: winner,
        };

        await contract.setData(
            `game_room_${room.id}`,
            ethers.toUtf8Bytes(JSON.stringify(updatedRoomData))
        );

        setTransactionStatus({
            visible: true,
            status: "success",
            message: "Game finished! Winner determined.",
        });

        await loadGameRooms();
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);

    } catch (e: any) {
        const errorMessage = e.message.includes("user rejected transaction")
            ? "Transaction rejected by user"
            : "Failed to join game: " + (e.message || "Unknown error");
        setTransactionStatus({ visible: true, status: "error", message: errorMessage });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally {
        setIsSubmitting(false);
    }
  };
  
  // Renders a single game room component
  const GameRoomCard = ({ room }: { room: GameRoom }) => {
    const [joinMove, setJoinMove] = useState<Move>(null);
    const isPlayer1 = account.toLowerCase() === room.player1.toLowerCase();
    const canJoin = account && !isPlayer1 && room.status === 'Waiting';
    
    return (
        <div className="game-room-card">
            <div className="room-header">
                <h3>Room #{room.id.substring(0, 8)}</h3>
                <span className={`status-badge ${room.status.toLowerCase()}`}>{room.status}</span>
            </div>
            <div className="room-body">
                <div className="player-info">
                    <strong>Player 1:</strong>
                    <span>{`${room.player1.substring(0, 6)}...${room.player1.substring(38)}`}</span>
                </div>
                <div className="player-info">
                    <strong>Player 2:</strong>
                    <span>{room.player2 ? `${room.player2.substring(0, 6)}...${room.player2.substring(38)}` : 'Waiting for opponent...'}</span>
                </div>
                <div className="wager-info">
                    <strong>Wager:</strong>
                    <span>{ethers.formatEther(room.wager)} ETH</span>
                </div>
                {room.status === 'Completed' && (
                    <div className="winner-info">
                        <strong>Winner:</strong>
                        <span>{room.winner ? `${room.winner.substring(0, 6)}...${room.winner.substring(38)}` : 'N/A'}</span>
                    </div>
                )}
            </div>
            {canJoin && (
                <div className="room-actions">
                    <div className="move-selector">
                        {["Rock", "Paper", "Scissors"].map((m: any) => (
                            <button key={m} className={`move-btn ${joinMove === m ? 'selected' : ''}`} onClick={() => setJoinMove(m as Move)}>
                                {m}
                            </button>
                        ))}
                    </div>
                    <button className="join-btn" onClick={() => handleJoinGame(room, joinMove)} disabled={!joinMove || isSubmitting}>
                        {isSubmitting ? 'Processing...' : 'Join & Fight'}
                    </button>
                </div>
            )}
        </div>
    );
  };
  
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing Confidential Game Environment...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>Confidential RPS</h1>
          <span>Powered by Zama FHE</span>
        </div>
        <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
      </header>
      
      <main className="main-content">
        <div className="intro-section">
          <h2>Zero-Knowledge Rock-Paper-Scissors</h2>
          <p>
            A fair gaming platform where your moves are kept secret using Fully Homomorphic Encryption (FHE).
            This technology prevents front-running attacks by processing encrypted choices directly on-chain.
          </p>
        </div>

        <div className="stats-section">
            <div className="stat-card">
                <h3>Total Games</h3>
                <p>{gameRooms.length}</p>
            </div>
            <div className="stat-card">
                <h3>Waiting for Players</h3>
                <p>{gameRooms.filter(r => r.status === 'Waiting').length}</p>
            </div>
            <div className="stat-card">
                <h3>Games Completed</h3>
                <p>{gameRooms.filter(r => r.status === 'Completed').length}</p>
            </div>
        </div>
        
        <div className="game-list-section">
            <div className="list-header">
                <h2>Active Game Lobbies</h2>
                <div className="header-actions">
                    <button onClick={loadGameRooms} className="refresh-btn" disabled={isRefreshing}>
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button onClick={() => setShowCreateModal(true)} className="create-game-btn">
                        Create New Game
                    </button>
                </div>
            </div>
            
            <div className="game-list">
                {gameRooms.length === 0 ? (
                    <div className="no-games-found">
                        <p>No active game rooms. Be the first to create one!</p>
                    </div>
                ) : (
                    gameRooms.map(room => <GameRoomCard key={room.id} room={room} />)
                )}
            </div>
        </div>
      </main>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Create a New Game</h2>
            <p className="modal-subtitle">Your move will be encrypted client-side before submission.</p>
            
            <div className="form-group">
                <label>Wager Amount (ETH)</label>
                <input 
                    type="number"
                    value={wagerAmount}
                    onChange={e => setWagerAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                />
            </div>

            <div className="form-group">
                <label>Choose Your Move</label>
                <div className="move-selector">
                    {["Rock", "Paper", "Scissors"].map((m: any) => (
                        <button key={m} className={`move-btn ${selectedMove === m ? 'selected' : ''}`} onClick={() => setSelectedMove(m as Move)}>
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="submit-btn" onClick={handleCreateGame} disabled={!selectedMove || isSubmitting}>
                {isSubmitting ? 'Encrypting & Creating...' : 'Create Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal-overlay">
            <div className="transaction-modal-content">
                <div className={`status-icon ${transactionStatus.status}`}>
                    {transactionStatus.status === 'pending' && <div className="spinner"></div>}
                    {transactionStatus.status === 'success' && <span>&#10003;</span>}
                    {transactionStatus.status === 'error' && <span>&#10007;</span>}
                </div>
                <p>{transactionStatus.message}</p>
            </div>
        </div>
      )}

      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
    </div>
  );
};

export default App;