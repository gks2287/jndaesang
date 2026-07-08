// 렌더링된 DOM 요소를 캡처해 A4 다중 페이지 PDF로 저장.
// PPT(lib/generatePPT.ts)처럼 레이아웃을 새로 그리지 않고, 화면에 실제 표시되는
// 뉴스레터 본문(renderGeneratedFullBody 결과)을 그대로 캡처해 100% 동일한 결과를 보장한다.
export async function downloadElementAsPDF(el: HTMLElement, fileName: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });

  const imgWidthMM = 210;  // A4 가로 (mm)
  const pageHeightMM = 297; // A4 세로 (mm)
  const imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF('p', 'mm', 'a4');
  let heightLeft = imgHeightMM;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidthMM, imgHeightMM);
  heightLeft -= pageHeightMM;

  while (heightLeft > 0) {
    position = heightLeft - imgHeightMM; // 다음 페이지에 이미지를 위로 올려 이어붙임
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidthMM, imgHeightMM);
    heightLeft -= pageHeightMM;
  }

  pdf.save(fileName);
}
