# Songo Game

A web-based multiplayer Songo game implemented with PHP and JavaScript.

## Deployment to Render

This project is configured for easy deployment to Render using Docker.

### Automatic Deployment (Recommended)
1. Push your code to a GitHub or GitLab repository.
2. Create a new **Web Service** on Render.
3. Connect your repository.
4. Render will automatically detect the `render.yaml` file (Blueprint) and set up the service, including:
   - Docker runtime.
   - A persistent disk for the `/var/www/html/games` directory (essential for saving game state between restarts).
   - Port mapping for Apache (Port 80).

### Manual Deployment
If you prefer manual configuration:
1. **Runtime**: Select `Docker`.
2. **Plan**: Free or any other available plan.
3. **Disk**: Add a mount point:
   - **Mount Path**: `/var/www/html/games`
   - **Size**: 1GB (or as needed).
4. **Environment Variables**:
   - `PORT`: `80`

## Project Structure
- `index.html`: Main game interface.
- `style.css`: Game styles.
- `script.js`: Game logic (client-side).
- `api.php`: Backend API for managing game states and network play.
- `games/`: Directory where game state JSON files are stored.
- `Dockerfile`: Docker configuration for PHP/Apache.
- `render.yaml`: Render Blueprint configuration.