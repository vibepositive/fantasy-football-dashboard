# Boomtown Dynasty Command Center

GitHub Pages dashboard for Sleeper league `1312504205092610048`, username `chrisgervais`, team **Boomtown Splash Hogs**.

## Setup
1. Create a new **Public** GitHub repository named `boomtown-dynasty-dashboard`.
2. Upload all files/folders from this project to the repository root.
3. Go to **Actions → Update Sleeper Dashboard → Run workflow**. Wait for the run to turn green.
4. Go to **Settings → Pages**. Under Build and deployment choose **Deploy from a branch**, `main`, `/ (root)`, then Save.
5. Open the Pages URL GitHub provides.

The Action refreshes `snapshot.json` every hour. The site has buttons for **Analyze Boomtown**, **Find Trades**, and **Analyze Selected**. These generate a prompt that points ChatGPT at the live public snapshot URL.

## Security
No Sleeper password or API key is used. The project is read-only. GitHub Pages is public, so the generated fantasy league snapshot is also public. Do not add secrets to this repository.
