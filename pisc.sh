echo "Pulling latest changes..."
git pull

echo "Installing dependencies..."
npm install

echo "Running tsc build..."
tsc

echo "Restarting pm2..."
pm2 restart 0