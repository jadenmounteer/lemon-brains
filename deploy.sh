#!/bin/bash

# Get the repository name from git config
REPO_NAME=$(basename `git rev-parse --show-toplevel`)

# Get the GitHub username from the remote URL instead of git config
GITHUB_USERNAME=$(git remote get-url origin | sed -n 's/.*github\.com[\/:]\([^/]*\).*/\1/p')

echo "🚀 Deploying $REPO_NAME to GitHub Pages..."

# Build the app in production mode with proper base href
echo "📦 Building the application..."
ng build --configuration production --base-href "/$REPO_NAME/"

# Deploy to GitHub Pages
echo "🚀 Deploying to GitHub Pages..."
npx angular-cli-ghpages --dir=dist/$REPO_NAME/browser

echo "✅ Deployment complete!"
echo "🌎 Your app should be available at: https://$GITHUB_USERNAME.github.io/$REPO_NAME" 