import { create } from 'zustand';

export const useStore = create((set) => ({
  // User state
  user: null,
  setUser: (user) => set({ user }),
  
  // Current game session state
  gameSession: null,
  players: [],
  currentQuestion: null,
  leaderboard: [],
  
  // Game host actions
  setGameSession: (session) => set({ gameSession: session }),
  addPlayer: (player) =>
    set((state) => {
      // Check if player already exists
      const exists = state.players.some(p => p.id === player.id);
      if (exists) {
        return state; // Don't add duplicate player
      }
      return {
        players: [...state.players, player],
      };
    }),
  removePlayer: (playerId) =>
    set((state) => ({
      players: state.players.filter((p) => p.id !== playerId),
    })),
  setCurrentQuestion: (question) => set({ currentQuestion: question }),
  updateLeaderboard: (newLeaderboard) =>
    set({
      leaderboard: newLeaderboard,
    }),
  
  // Reset game state
  resetGame: () =>
    set({
      players: [],
      leaderboard: [],
      currentQuestion: null,
      gameSession: null
    }),
})); 