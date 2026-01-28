
import json
import os
import re
import time
import base64
from pathlib import Path
from typing import List, Dict, Any, Optional

import fitz  # PyMuPDF
from docling.document_converter import DocumentConverter

# ==========================================
# 1. Helper Functions (Geometry & Utils)
# ==========================================

def get_text_content(element) -> str:
    """Docling 요소에서 텍스트 추출"""
    if hasattr(element, "text"):
        return element.text
    elif hasattr(element, "export_to_markdown"):
         try:
             return element.export_to_markdown()
         except:
             return ""
    return ""

def is_overlapping_with_images(text_bbox: List[float], image_bboxes: List[Dict], page_num: int, threshold: float = 0.5) -> bool:
    """
    텍스트 BBox가 이미지 BBox와 겹치는지 확인 (찌꺼기 제거용)
    threshold: 겹치는 면적 비율 (0.5 = 50% 이상 겹치면 중복 간주)
    """
    if not text_bbox:
        return False
        
    tx1, ty1, tx2, ty2 = text_bbox
    # (Docling BBox는 [L, T, R, B] 형태)
    
    text_area = (tx2 - tx1) * (ty2 - ty1)
    if text_area <= 0:
        return False

    for img in image_bboxes:
        if img["page"] != page_num:
            continue
        
        ix1, iy1, ix2, iy2 = img["bbox"]
        
        # 교차 영역 계산
        x_left = max(tx1, ix1)
        y_top = max(ty1, iy1)
        x_right = min(tx2, ix2)
        y_bottom = min(ty2, iy2)
        
        if x_right > x_left and y_bottom > y_top:
            intersection_area = (x_right - x_left) * (y_bottom - y_top)
            if (intersection_area / text_area) > threshold:
                return True
                
    return False

# ==========================================
# 2. Main Processor Class
# ==========================================

class PDFProcessor:
    def __init__(self, upload_dir: str = "/app/uploads"):
        self.upload_dir = upload_dir
        self.converter = DocumentConverter() # Docling 초기화
        
        # 이미지 저장 경로 생성
        os.makedirs(self.upload_dir, exist_ok=True)

    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        PDF를 처리하여 구조화된 데이터(Elements)를 반환합니다.
        순서: Docling 분석 -> 이미지/표 BBox 추출 -> PyMuPDF 크롭 -> 텍스트 필터링
        """
        start_time = time.time()
        print(f"🚀 Processing PDF: {pdf_path}")
        
        # [Step 1] Docling Layout Analysis
        docling_result = self._run_docling(pdf_path)
        elements = docling_result["elements"]
        
        # [Step 1.5] Precision Layout Sorting (BBox 기반 정렬)
        # pdf_parsing/3.py의 로직 이식: (페이지, -상단Y, 좌측X) 순으로 정렬
        def sort_key(item):
            page = item["page"]
            bbox = item.get("bbox")
            if not bbox: return (page, 0, 0)
            # PDF 좌표계는 Bottom-Up이므로, 시각적 상단(Top)은 Y값이 큼.
            # 따라서 -max(y1, y2)를 하여 시각적 위쪽이 먼저 오도록 함.
            y_top = max(bbox[1], bbox[3])
            x_left = min(bbox[0], bbox[2])
            return (page, -y_top, x_left)

        elements.sort(key=sort_key)
        print(f"  🔄 Precision Sorting complete: sorted {len(elements)} elements")
        
        # [Step 2] 이미지/표 요소 식별 및 BBox 수집
        image_elements = [e for e in elements if e["type"] in ["image", "table"] and e["bbox"]]
        image_bboxes = [{"page": e["page"], "bbox": e["bbox"]} for e in image_elements]
        
        # [Step 3] PyMuPDF Image Cropping
        # 이미지와 표를 고화질로 잘라내어 저장하고, 저장된 경로를 element에 추가합니다.
        self._crop_images(pdf_path, image_elements)
        
        # [Step 4] Filtering & Block Assembly
        final_blocks = []
        
        for e in elements:
            # 4-1. 이미지/표는 무조건 포함 (이미 경로가 할당됨)
            if e["type"] in ["image", "table"]:
                # 크롭에 실패하여 image_path가 없는 경우는 제외할 수도 있음
                if e.get("image_path"): 
                    final_blocks.append(e)
                continue
                
            # 4-2. 텍스트 요소 (Header, Paragraph 등)
            # 이미지 영역과 겹치는지 확인 (Overlap Check)
            if e.get("bbox") and is_overlapping_with_images(e["bbox"], image_bboxes, e["page"]):
                # 겹치면 '찌꺼기'로 간주하여 Skip
                print(f"  🗑️ Skipped overlapping text (Page {e['page']}): {e['text'][:20]}...")
                continue
            
            # 4-3. 유효한 텍스트만 추가
            if e.get("text") and len(e["text"].strip()) > 0:
                final_blocks.append(e)
                
        # [Step 5] 결과 반환
        elapsed = time.time() - start_time
        return {
            "status": "success",
            "filename": os.path.basename(pdf_path),
            "total_pages": docling_result["total_pages"],
            "processed_time": f"{elapsed:.2f}s",
            "blocks": final_blocks
        }

    def _run_docling(self, pdf_path: str) -> Dict:
        """Docling 실행 및 JSON 변환"""
        print("  Running Docling...")
        result = self.converter.convert(pdf_path)
        doc = result.document
        
        analyzed_elements = []
        
        type_mapping = {
            "SECTION_HEADER": "heading",    # BlockNote: heading
            "Title": "heading",
            "TEXT": "paragraph",            # BlockNote: paragraph
            "Body Text": "paragraph",
            "LIST_ITEM": "bulletListItem",  # BlockNote: bulletListItem (numbered는 별도 처리 필요하지만 일단 통일)
            "PICTURE": "image",             # BlockNote: image
            "FIGURE": "image",
            "TABLE": "table",               # Custom logic needed (image로 처리 or table block)
            "CAPTION": "paragraph",         # 캡션도 텍스트로
            "CODE": "paragraph"             # 코드도 일단 텍스트로
        }
        
        last_page = 1
        for element, level in doc.iterate_items():
            # 위치 정보 (BBox)
            bbox = None
            page_no = 1
            if hasattr(element, "prov") and element.prov:
                prov = element.prov[0]
                page_no = prov.page_no
                bbox = [prov.bbox.l, prov.bbox.t, prov.bbox.r, prov.bbox.b]
            
            # [페이지 구분선] 페이지 전환 시 divider 삽입
            if page_no > last_page:
                analyzed_elements.append({
                    "type": "divider",
                    "text": "",
                    "page": page_no,
                    "bbox": None,
                    "props": {}
                })
                last_page = page_no
            
            raw_type = element.label.name if hasattr(element, "label") else "unknown"
            final_type = type_mapping.get(raw_type, "paragraph") # 기본값 paragraph
            
            # Table은 이미지로 처리하는 전략 ("table" 타입 유지하되, 나중에 크롭됨)
            text_content = get_text_content(element).strip()
            # 연속된 공백 제거
            text_content = re.sub(r'\s+', ' ', text_content)
            
            # [Bug Fix] 텍스트가 없더라도 이미지나 표라면 건너뛰지 않음
            if not text_content and final_type not in ["image", "table"]:
                continue

            # 🌟 [헤더 감지 극대화] 핵심 섹션 및 짧은 제목군 공격적 배정
            is_strong_header = False
            
            # 1. 문서 핵심 섹션 (Abstract, Intro 등) 무조건 헤더
            core_keywords = ["Abstract", "Introduction", "Related Work", "Methodology", "Experiments", "Results", "Discussion", "Conclusion", "References", "Acknowledgement"]
            core_keywords_ko = ["서론", "본론", "결론", "요약", "참고문헌", "초록", "방법론", "결과"]
            
            clean_text = text_content
            # 텍스트가 키워드 중 하나로 시작하거나 일치하면서 30자 미만이면 강력한 헤더
            if any(clean_text.lower().startswith(kw.lower()) for kw in core_keywords + core_keywords_ko) and len(clean_text) < 40:
                is_strong_header = True
            
            # 2. 숫자로 시작하는 전형적인 섹션 제목 패턴
            if final_type == "paragraph" and len(clean_text) < 60:
                if re.match(r'^(\d+(\.\d+)*[\.\s]|[IVXLC]+\.|\u25CF|\u25CB)', clean_text):
                    is_strong_header = True

            if is_strong_header:
                final_type = "heading"

            # 🌟 [리스트 및 타입 세밀화]
            if final_type == "bulletListItem" or (final_type == "paragraph" and clean_text.startswith(("- ", "* ", "\u2022 "))):
                if final_type == "paragraph":
                    final_type = "bulletListItem"
                    text_content = re.sub(r'^[\-\*\u2022]\s*', '', text_content)
                
                if re.match(r'^(\d+[\.\)]|[\u2460-\u2473])', clean_text):
                    final_type = "numberedListItem"

            # Heading Level 처리 (시각적 위계 극대화)
            props = {}
            if final_type == "heading":
                # 패턴 기반 레벨 할당
                if re.match(r'^\d+\.?\s+[A-Z가-힣]', clean_text) or any(kw.lower() in clean_text.lower() for kw in core_keywords + core_keywords_ko):
                    props["level"] = 1 # 섹션 대제목 (H1)
                elif re.match(r'^\d+\.\d+', clean_text) or len(clean_text) < 15:
                    props["level"] = 2 # 중분류 (H2)
                else:
                    props["level"] = 3 # 소분류 (H3)
                
                # Docling level 보정 (H1이 너무 많지 않도록)
                if level is not None and level > 1:
                    props["level"] = min(level + 1, 3)

            # [필터링] 노이즈 제거 (숫자만 있거나 너무 짧은 노이즈)
            if final_type == "paragraph" and (len(clean_text) < 2 or clean_text.isdigit()):
                continue

            item = {
                "type": final_type,
                "text": text_content,
                "page": page_no,
                "bbox": bbox,
                "props": props
            }
            analyzed_elements.append(item)
            
        return {
            "total_pages": len(doc.pages),
            "elements": analyzed_elements
        }

    def _crop_images(self, pdf_path: str, image_elements: List[Dict]):
        """PyMuPDF를 사용하여 이미지/표 영역 크롭"""
        print(f"  Cropping {len(image_elements)} images/tables...")
        
        if not image_elements:
            return

        doc = fitz.open(pdf_path)
        
        for i, item in enumerate(image_elements):
            if not item["bbox"]:
                continue
                
            page_num = item["page"]
            # PyMuPDF는 0-index
            if page_num - 1 >= len(doc): 
                continue
                
            page = doc[page_num - 1]
            page_h = page.rect.height
            
            l, t, r, b = item["bbox"]
            
            # Y축 반전 및 좌표 변환 (Docling -> PyMuPDF)
            # Docling: Bottom-Left Origin (PDF standard) usually, but check prov.
            # Assuming Docling returns coords as [L, T, R, B] where T < B in visual logic?
            # NO, Docling 'prov' uses PDF coordinates (Bottom-Up).
            # We need to flip Y.
            
            docling_top_y = max(t, b)     # PDF좌표계에선 큰 값이 위쪽
            docling_bottom_y = min(t, b)  # PDF좌표계에선 작은 값이 아래쪽
            
            new_top = page_h - docling_top_y
            new_bottom = page_h - docling_bottom_y
            
            # Rect 생성
            rect = fitz.Rect(l, new_top, r, new_bottom)
            rect = rect & page.rect # 클램핑
            
            # [필터링 복구] 너무 작은 이미지(로고, 장식 등)는 원본 사양대로 제외
            MIN_SIZE_PTS = 50 
            if rect.width < MIN_SIZE_PTS or rect.height < MIN_SIZE_PTS:
                print(f"  🗑️ [Skipped] Too small: {rect.width:.1f}x{rect.height:.1f} pts (Page {page_num})")
                continue

            # 비율 필터 복구 (선, 상자 테두리 등 장식 요소 제외)
            aspect_ratio = rect.width / rect.height
            if aspect_ratio > 30 or aspect_ratio < 0.03:
                print(f"  🗑️ [Skipped] Extreme aspect ratio: {aspect_ratio:.1f} (Page {page_num})")
                continue
                
            # 고화질 캡처
            zoom = 300 / 72 # 300 DPI
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, clip=rect)
            
            # 파일 저장
            # hash나 timestamp를 써서 유니크하게 만드는게 좋음
            timestamp = int(time.time() * 1000)
            filename = f"crop_{timestamp}_{i}.png"
            save_path = os.path.join(self.upload_dir, filename)
            
            pix.save(save_path)
            
            # 결과에 경로(URL path) 추가
            # 프론트엔드에서 접근할 때는 /uploads/filename 형태가 됨
            # 여기서는 파일명만 저장하거나 웹 경로로 저장
            item["image_path"] = f"/uploads/{filename}"
            item["image_filename"] = filename
