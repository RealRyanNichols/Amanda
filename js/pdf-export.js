// Client-side PDF export — uses jsPDF loaded from esm.sh CDN on first use.
// Zero backend cost. Perfect for keepsakes like Letters to your baby.

let _jsPDFPromise = null;
async function getJsPDF() {
  if (_jsPDFPromise) return _jsPDFPromise;
  _jsPDFPromise = (async () => {
    const mod = await import("https://esm.sh/jspdf@2.5.2");
    return mod.jsPDF || mod.default?.jsPDF || mod.default;
  })();
  return _jsPDFPromise;
}

/**
 * Export all letters to baby as a single beautifully-typeset PDF keepsake.
 * @param {Array<{body:string, author:string, createdAt:number}>} letters
 * @param {string} babyName
 * @returns {Promise<void>}
 */
export async function exportLettersAsPDF(letters, babyName) {
  if (!letters?.length) return;
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 64;
  const lineHeight = 18;
  const bodyWidth = pageW - margin * 2;

  // Cover page
  doc.setFont("times", "italic");
  doc.setFontSize(14);
  doc.setTextColor(138, 122, 74);
  doc.text("Letters for", pageW / 2, 220, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(42);
  doc.setTextColor(59, 47, 28);
  doc.text(babyName || "Our Baby", pageW / 2, 280, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(122, 107, 72);
  const dateRange = letters.length > 0
    ? `From ${new Date(Math.min(...letters.map(l => l.createdAt))).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
    : "";
  doc.text(dateRange, pageW / 2, 320, { align: "center" });
  doc.setFontSize(10);
  doc.text("A little book of everything we wanted you to know.", pageW / 2, pageH - 100, { align: "center" });

  // Sort chronologically — oldest first so it reads like a diary
  const sorted = [...letters].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  for (const letter of sorted) {
    doc.addPage();
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(138, 122, 74);
    const dateStr = new Date(letter.createdAt).toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    doc.text(dateStr, margin, margin);

    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(59, 47, 28);
    const lines = doc.splitTextToSize(letter.body || "", bodyWidth);

    let y = margin + 40;
    for (const line of lines) {
      if (y > pageH - margin - 60) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }

    if (letter.author) {
      doc.setFont("times", "italic");
      doc.setFontSize(12);
      doc.setTextColor(90, 74, 39);
      y += lineHeight;
      doc.text(`— ${letter.author}`, margin, y);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const who = (babyName || "baby").toLowerCase().replace(/\s+/g, "-");
  doc.save(`letters-to-${who}-${today}.pdf`);
}
