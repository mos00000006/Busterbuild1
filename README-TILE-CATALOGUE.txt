BUSTERBUILD TILE CATALOGUE - GITHUB PAGES VERSION
================================================

WHY THE PREVIOUS VERSION FAILED
GitHub Pages serves static HTML/CSS/JS only. It does not execute pulse-proxy.php,
so the browser could not retrieve the catalogue.

HOW THIS VERSION WORKS
1. tile-catalogue.html reads a LOCAL file:
      data/pulse-tile-catalogue.json
2. A GitHub Action runs on the repository after these files are pushed.
3. The Action collects Pulse tile catalogue data server-side and writes the JSON.
4. GitHub Pages then serves the local JSON. No PHP proxy is required.

FIRST SETUP
- Upload/commit ALL files in this package to the main branch.
- Open the GitHub repository -> Actions -> "Update Pulse tile catalogue".
- If it has not already run from the upload commit, click "Run workflow".
- When the workflow finishes, GitHub Pages will rebuild automatically.

AUTO UPDATES
The workflow is scheduled daily at 02:20 UTC and refreshes names, product codes,
prices, category membership and factual product specifications.

IMPORTANT
If GitHub Actions are disabled for the repository, enable Actions in repository
Settings -> Actions -> General.
