import jsPDF from 'jspdf';
import { IssuedCertificate } from '../types';
import { getVerificationUrl, interpolateCertificateText } from './certificateTemplates';

function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const clean = (hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }
  return fallback;
}

function resolvePdfFont(family?: string): 'helvetica' | 'times' | 'courier' {
  if (family === 'Georgia') return 'times';
  if (family === 'JetBrains Mono') return 'courier';
  return 'helvetica';
}

export async function downloadCertificatePdf(
  cert: IssuedCertificate,
  qrCanvasElement?: HTMLCanvasElement | null
): Promise<void> {
  const orientation = cert.orientation === 'portrait' ? 'portrait' : 'landscape';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bgRgb = hexToRgb(cert.backgroundColor, [255, 255, 255]);
  const accentRgb = hexToRgb(cert.accentColor, [30, 58, 138]);
  const textRgb = hexToRgb(cert.textColor, [15, 23, 42]);
  const fontName = resolvePdfFont(cert.fontFamily);

  // Canvas fill
  doc.setFillColor(...bgRgb);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Optional background artwork
  if (cert.backgroundImageUrl && cert.backgroundImageUrl.startsWith('data:image/')) {
    try {
      const imgType = cert.backgroundImageUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(cert.backgroundImageUrl, imgType, 0, 0, pageWidth, pageHeight);
    } catch {
      // Fallback cleanly to solid background
    }
  }

  // Framing guilloche double border
  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(1.2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  doc.setLineWidth(0.35);
  doc.rect(13.5, 13.5, pageWidth - 27, pageHeight - 27);

  // Corner accent bars
  doc.setFillColor(...accentRgb);
  doc.rect(10, 10, 18, 2.5, 'F');
  doc.rect(pageWidth - 28, 10, 18, 2.5, 'F');
  doc.rect(10, pageHeight - 12.5, 18, 2.5, 'F');
  doc.rect(pageWidth - 28, pageHeight - 12.5, 18, 2.5, 'F');

  // Optional University & Society logos
  if (cert.universityLogoUrl && cert.universityLogoUrl.startsWith('data:image/')) {
    try {
      const t = cert.universityLogoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(cert.universityLogoUrl, t, 20, 18, 18, 18);
    } catch {}
  }
  if (cert.societyLogoUrl && cert.societyLogoUrl.startsWith('data:image/')) {
    try {
      const t = cert.societyLogoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(cert.societyLogoUrl, t, pageWidth - 38, 18, 18, 18);
    } catch {}
  }

  const vars = {
    participantName: cert.holderName,
    eventTitle: cert.eventTitle,
    issueDate: cert.issueDate,
    certificateId: cert.certificateId,
  };

  const elements = cert.elements;

  // Authority & Subtitle
  const authPos = elements.authority || { x: 50, y: 14, align: 'center' };
  const authX = (authPos.x / 100) * pageWidth;
  const authY = (authPos.y / 100) * pageHeight;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...accentRgb);
  doc.text((cert.issuingAuthority || 'Campus Connect University Portal').toUpperCase(), authX, authY, {
    align: authPos.align || 'center',
  });
  doc.setFontSize(8.5);
  doc.setFont(fontName, 'normal');
  doc.text(cert.subtitle || cert.templateCategory, authX, authY + 5.5, {
    align: authPos.align || 'center',
  });

  // Main Certificate Title
  const titlePos = elements.title || { x: 50, y: 27, align: 'center' };
  const titleX = (titlePos.x / 100) * pageWidth;
  const titleY = (titlePos.y / 100) * pageHeight;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(orientation === 'portrait' ? 22 : 25);
  doc.setTextColor(...textRgb);
  doc.text(cert.title || 'Certificate of Participation', titleX, titleY, {
    align: titlePos.align || 'center',
    maxWidth: pageWidth - 52,
  });

  doc.setFont(fontName, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...accentRgb);
  doc.text('THIS IS PROUDLY PRESENTED TO', titleX, titleY + 10, {
    align: titlePos.align || 'center',
  });

  // Recipient Name
  const recPos = elements.recipient || { x: 50, y: 46, align: 'center' };
  const recX = (recPos.x / 100) * pageWidth;
  const recY = (recPos.y / 100) * pageHeight;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(orientation === 'portrait' ? 24 : 28);
  doc.setTextColor(...accentRgb);
  doc.text(cert.holderName, recX, recY, {
    align: recPos.align || 'center',
    maxWidth: pageWidth - 48,
  });

  // Accent rule under recipient name
  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(0.5);
  doc.line(Math.max(30, recX - 55), recY + 3.5, Math.min(pageWidth - 30, recX + 55), recY + 3.5);

  // Body Citation
  const bodyPos = elements.body || { x: 50, y: 60, align: 'center' };
  const bodyX = (bodyPos.x / 100) * pageWidth;
  const bodyY = (bodyPos.y / 100) * pageHeight;
  const bodyText = interpolateCertificateText(cert.description, vars);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...textRgb);
  doc.text(bodyText, bodyX, bodyY, {
    align: bodyPos.align || 'center',
    maxWidth: orientation === 'portrait' ? pageWidth - 42 : pageWidth - 68,
  });

  doc.setFontSize(9);
  doc.text(`Issued on ${cert.issueDate}`, bodyX, bodyY + 15, {
    align: bodyPos.align || 'center',
  });

  // Signatures block
  const sigPos = elements.signatures || { x: 36, y: 81, align: 'center' };
  const sigCenterX = orientation === 'portrait' ? pageWidth / 2 : (sigPos.x / 100) * pageWidth;
  const sigY = (sigPos.y / 100) * pageHeight;

  const leftSigX = Math.max(48, sigCenterX - 36);
  const rightSigX = Math.min(pageWidth - 68, sigCenterX + 36);

  if (cert.signatureImageUrl && cert.signatureImageUrl.startsWith('data:image/')) {
    try {
      const t = cert.signatureImageUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(cert.signatureImageUrl, t, leftSigX - 15, sigY - 14, 30, 11);
    } catch {}
  }

  doc.setDrawColor(...textRgb);
  doc.setLineWidth(0.35);
  doc.line(leftSigX - 24, sigY, leftSigX + 24, sigY);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...textRgb);
  doc.text(cert.organiserName || 'Event Organiser', leftSigX, sigY + 4.5, { align: 'center' });
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  doc.text(cert.signatoryDesignation || 'Organising Lead', leftSigX, sigY + 8.5, { align: 'center' });

  if (cert.facultyCoordinator) {
    doc.line(rightSigX - 24, sigY, rightSigX + 24, sigY);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.text(cert.facultyCoordinator, rightSigX, sigY + 4.5, { align: 'center' });
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.text('Faculty Coordinator', rightSigX, sigY + 8.5, { align: 'center' });
  }

  // Verification QR & Certificate ID
  if (cert.includeQr !== false) {
    const qrPos = elements.qr || { x: 85, y: 81 };
    const qrX = orientation === 'portrait' ? pageWidth - 36 : (qrPos.x / 100) * pageWidth - 11;
    const qrY = orientation === 'portrait' ? pageHeight - 40 : (qrPos.y / 100) * pageHeight - 13;

    const canvas =
      qrCanvasElement ||
      (document.getElementById(`cert-qr-${cert.certificateId}`) as HTMLCanvasElement | null);
    if (canvas) {
      try {
        const qrDataUrl = canvas.toDataURL('image/png');
        doc.setFillColor(255, 255, 255);
        doc.rect(qrX - 1.5, qrY - 1.5, 25, 25, 'F');
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 22, 22);
      } catch {}
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...textRgb);
    doc.text(`ID: ${cert.certificateId}`, qrX + 11, qrY + 26, { align: 'center' });
  } else {
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...textRgb);
    doc.text(`Certificate ID: ${cert.certificateId}`, pageWidth / 2, pageHeight - 17, {
      align: 'center',
    });
  }

  // Quiet verification URL footer
  doc.setFont(fontName, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...accentRgb);
  doc.text(`Verify authenticity at ${getVerificationUrl(cert.certificateId)}`, 16, pageHeight - 16);

  const safeFileName = `${cert.holderName.replace(/[^a-zA-Z0-9]+/g, '_')}_${cert.certificateId}.pdf`;
  doc.save(safeFileName);
}
