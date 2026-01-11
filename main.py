import pygame
import chess

# Ensure the correct python-chess package (with chess.engine) is installed
try:
    import chess.engine  # type: ignore
except Exception as exc:
    raise SystemExit(
        "python-chess with the engine submodule is missing. Run 'uv sync --reinstall-package python-chess chess'"
    ) from exc
import math

# --- CONFIGURATION ---
WIDTH, HEIGHT = 600, 600
SQUARE_SIZE = WIDTH // 8
DEPTH = 2  # AI Search Depth (Higher = Stronger but slower)

# Colors
WHITE_COLOR = (240, 217, 181)
BLACK_COLOR = (181, 136, 99)
HIGHLIGHT_COLOR = (186, 202, 68)
TEXT_COLOR = (0, 0, 0)

# Piece Values for AI
PIECE_VALUES = {
    chess.PAWN: 10,
    chess.KNIGHT: 30,
    chess.BISHOP: 30,
    chess.ROOK: 50,
    chess.QUEEN: 90,
    chess.KING: 900
}

# --- AI ENGINE (MINIMAX) ---
def evaluate_board(board):
    """Calculates a score for the board state."""
    if board.is_checkmate():
        if board.turn:  # If it's White's turn and they are mated
            return -9999
        else:
            return 9999
    if board.is_stalemate() or board.is_insufficient_material():
        return 0

    score = 0
    # Material difference
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            value = PIECE_VALUES.get(piece.piece_type, 0)
            if piece.color == chess.WHITE:
                score += value
            else:
                score -= value
    return score

def minimax(board, depth, alpha, beta, maximizing_player):
    """The Minimax algorithm with Alpha-Beta Pruning."""
    if depth == 0 or board.is_game_over():
        return evaluate_board(board)

    moves = list(board.legal_moves)
    
    if maximizing_player: # White wants to maximize score
        max_eval = -math.inf
        for move in moves:
            board.push(move)
            eval = minimax(board, depth - 1, alpha, beta, False)
            board.pop()
            max_eval = max(max_eval, eval)
            alpha = max(alpha, eval)
            if beta <= alpha:
                break
        return max_eval
    else: # Black wants to minimize score
        min_eval = math.inf
        for move in moves:
            board.push(move)
            eval = minimax(board, depth - 1, alpha, beta, True)
            board.pop()
            min_eval = min(min_eval, eval)
            beta = min(beta, eval)
            if beta <= alpha:
                break
        return min_eval

def get_best_move(board, depth):
    """Root function to find the best move for the AI."""
    best_move = None
    best_value = math.inf  # Black seeks minimum score
    alpha = -math.inf
    beta = math.inf

    for move in board.legal_moves:
        board.push(move)
        board_value = minimax(board, depth - 1, alpha, beta, True) # Next is White (True)
        board.pop()
        
        if board_value < best_value:
            best_value = board_value
            best_move = move
            
    return best_move

# --- GUI FUNCTIONS ---
def draw_board(screen):
    """Draws the checkerboard pattern."""
    for row in range(8):
        for col in range(8):
            color = WHITE_COLOR if (row + col) % 2 == 0 else BLACK_COLOR
            pygame.draw.rect(screen, color, (col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE))

def draw_pieces(screen, board, font):
    """Draws the pieces using Unicode characters."""
    # Mapping of pieces to Unicode
    unicode_pieces = {
        'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
        'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
    }
    
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            symbol = unicode_pieces[piece.symbol()]
            text_surface = font.render(symbol, True, TEXT_COLOR)
            
            # Center text in square
            col = chess.square_file(square)
            row = 7 - chess.square_rank(square) # Pygame y acts top-down, chess ranks bottom-up
            
            text_rect = text_surface.get_rect(center=(col * SQUARE_SIZE + SQUARE_SIZE // 2, 
                                                      row * SQUARE_SIZE + SQUARE_SIZE // 2))
            screen.blit(text_surface, text_rect)

def highlight_square(screen, square):
    """Highlights a selected square."""
    if square is not None:
        col = chess.square_file(square)
        row = 7 - chess.square_rank(square)
        s = pygame.Surface((SQUARE_SIZE, SQUARE_SIZE))
        s.set_alpha(100) # Transparency
        s.fill(HIGHLIGHT_COLOR)
        screen.blit(s, (col * SQUARE_SIZE, row * SQUARE_SIZE))

# --- MAIN GAME LOOP ---
def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Python Chess AI")
    
    # Try different fonts to ensure unicode pieces render
    try:
        font = pygame.font.SysFont("Segoe UI Symbol", 60)
    except:
        font = pygame.font.SysFont("Arial", 60)

    board = chess.Board()
    selected_square = None
    running = True

    while running:
        draw_board(screen)
        highlight_square(screen, selected_square)
        draw_pieces(screen, board, font)
        
        if board.is_checkmate():
            print("Checkmate!")
            running = False
            
        pygame.display.flip()

        # Input Handling
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            
            # Human Turn (White)
            if board.turn == chess.WHITE:
                if event.type == pygame.MOUSEBUTTONDOWN:
                    x, y = pygame.mouse.get_pos()
                    col = x // SQUARE_SIZE
                    row = y // SQUARE_SIZE
                    # Convert Pygame coordinates to Chess Square
                    clicked_square = chess.square(col, 7 - row)

                    if selected_square is None:
                        # Select piece
                        if board.piece_at(clicked_square) and board.piece_at(clicked_square).color == chess.WHITE:
                            selected_square = clicked_square
                    else:
                        # Attempt Move
                        move = chess.Move(selected_square, clicked_square)
                        # Check for promotion (auto-queen for simplicity)
                        if move not in board.legal_moves:
                            move = chess.Move(selected_square, clicked_square, promotion=chess.QUEEN)
                        
                        if move in board.legal_moves:
                            board.push(move)
                            selected_square = None # Deselect
                        else:
                            # If invalid move, change selection or deselect
                            if board.piece_at(clicked_square) and board.piece_at(clicked_square).color == chess.WHITE:
                                selected_square = clicked_square
                            else:
                                selected_square = None
            
        # AI Turn (Black)
        if board.turn == chess.BLACK and not board.is_game_over():
            pygame.display.set_caption("AI is thinking...")
            pygame.event.pump() # Prevent freeze during calculation
            engine = chess.engine.SimpleEngine.popen_uci("stockfish/stockfish.exe")
            result = engine.play(board, chess.engine.Limit(time=0.5))
            aimove = board.push(result.move)
            if aimove:
                board.push(aimove)
                pygame.display.set_caption("Python Chess AI")

    pygame.quit()

if __name__ == "__main__":
    main()