BUSTERBUILD ROOT WEBSITE FIX

THE PROBLEM
The repository ROOT index.html was replaced by the Sales App.
That is why:
https://mos00000006.github.io/Busterbuild1/
opens the staff Sales App.

CORRECT STRUCTURE

PUBLIC WEBSITE:
Busterbuild1/index.html
https://mos00000006.github.io/Busterbuild1/

STAFF SALES APP:
Busterbuild1/sales-app/index.html
https://mos00000006.github.io/Busterbuild1/sales-app/

WHAT TO DO

In GitHub open:
Busterbuild1

IMPORTANT: stay in the ROOT of the repository.
Do NOT open the sales-app folder.

1. Replace the ROOT:
   index.html

2. Replace the ROOT:
   sw.js

Do not upload these two files inside sales-app.

The replacement root sw.js only removes the old accidental root Sales App
service worker. It does not replace /sales-app/sw.js.

DO NOT CHANGE OR DELETE:
- sales-app/
- data/
- scripts/
- .github/
- css/
- js/
- pictures/
- existing public website pages

AFTER GITHUB PAGES DEPLOYS

Open:
https://mos00000006.github.io/Busterbuild1/

Press Ctrl + F5 once on PC if the old Sales App screen is still cached.

The Staff Sales App remains:
https://mos00000006.github.io/Busterbuild1/sales-app/
