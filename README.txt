BusterBuild .99 Pricing Update

This update changes the Pulse catalogue prices to BusterBuild price endings of .99.

Current catalogue updated:
- Tiles: 468 products
- Combo Deals: 144 products

Replace these files in your GitHub repository:

data/
  pulse-tile-catalogue.json
  pulse-combo-catalogue.json

scripts/
  update_pulse_catalogue.py
  update_combo_catalogue.py

IMPORTANT:
The two script files make the change permanent. Future automatic Pulse catalogue updates
will continue to import the Pulse rand amount but will change the cents to .99 before
writing the BusterBuild catalogue.

Examples:
R419.90 -> R419.99
R259.90 -> R259.99
R399.80 -> R399.99

The normal Sales App URL does not change:
https://mos00000006.github.io/Busterbuild1/sales-app/
