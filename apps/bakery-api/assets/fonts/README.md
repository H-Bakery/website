# Schriften für die Rechnungs-PDF

`LiberationSans-Regular.ttf` und `LiberationSans-Bold.ttf` aus
[liberation-fonts 2.1.5](https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5),
unverändert. Lizenz: SIL Open Font License 1.1 (`LICENSE-LiberationFonts.txt`).

PDF/A verlangt eingebettete Schriften; die 14 Standardschriften von pdfkit (Helvetica …) werden
nicht eingebettet und scheiden deshalb aus. `src/services/invoice-pdf.ts` bettet nur die benutzten
Zeichen ein (Subset).
