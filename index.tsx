import React, { useState, useEffect, useRef, CSSProperties, useLayoutEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// --- Interfaces and Constants ---

interface SermonNote {
  id: string;
  title: string;
  date: string;
  serviceType: string;
  passage: string;
  content: string[];
  styles: {
    fontSize: string;
    fontFamily: string;
    fontWeight: string;
    color?: string;
  };
  drawingData: string[];
}

interface Page {
    content: string;
    drawingData: string;
}

type DrawingTool = 'pen' | 'eraser' | null;

const FONT_FAMILIES = [
  { name: '고딕 (기본)', value: 'Noto Sans KR,400' },
  { name: '고딕 (얇게)', value: 'Noto Sans KR,300' },
  { name: '고딕 (굵게)', value: 'Noto Sans KR,700' },
  { name: '명조 (기본)', value: 'Nanum Myeongjo,400' },
  { name: '명조 (굵게)', value: 'Nanum Myeongjo,700' },
  { name: '송명', value: 'Song Myung,400' },
  { name: '바탕 (기본)', value: 'Gowun Batang,400' },
  { name: '바탕 (굵게)', value: 'Gowun Batang,700' },
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const SERVICE_TYPES = [
  '주일오전예배',
  '주일오후예배',
  '수요일저녁예배',
  '새벽기도',
  '특별설교',
];
const TEXT_COLORS = ['#212529', '#dc3545', '#007bff', '#28a745', '#6c757d', '#fd7e14']; // Black, Red, Blue, Green, Grey, Orange
const PEN_COLORS = ['#dc3545', '#007bff', '#212529', '#28a745']; // Red, Blue, Black, Green
const PEN_THICKNESSES = [2, 5, 10, 15, 20];
const LOCAL_STORAGE_KEY = 'sermonNotes';


// --- Helper Functions ---

const createNewNote = (): SermonNote => ({
  id: Date.now().toString(),
  title: '',
  date: new Date().toISOString().split('T')[0],
  serviceType: SERVICE_TYPES[0],
  passage: '',
  content: [''],
  styles: {
    fontSize: '16px',
    fontFamily: 'Noto Sans KR',
    fontWeight: '400',
  },
  drawingData: [''],
});

const getDayOfWeek = (dateString: string): string => {
  if (!dateString) return '';
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  try {
    const date = new Date(dateString);
    // Adjust for timezone offset to prevent day shifting
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + timezoneOffset);
    return days[adjustedDate.getDay()];
  } catch (e) {
    return '';
  }
};

const drawOnCanvas = (canvas: HTMLCanvasElement, drawingData?: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!drawingData) return;

    try {
        const lines = JSON.parse(drawingData);
        if(!Array.isArray(lines)) return;
        
        lines.forEach((line: { points: {x: number, y: number}[], color: string, thickness: number, tool?: 'pen' | 'eraser' }) => {
            if (!line || !line.points || line.points.length < 2) return;
            
            const tool = line.tool || 'pen'; // Default to 'pen' for legacy data

            if (tool === 'pen') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = line.color;
            } else { // tool === 'eraser'
                ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeStyle = 'rgba(0,0,0,1)';
            }

            ctx.lineWidth = line.thickness;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(line.points[0].x, line.points[0].y);
            for (let i = 1; i < line.points.length; i++) {
                ctx.lineTo(line.points[i].x, line.points[i].y);
            }
            ctx.stroke();
        });
        
        ctx.globalCompositeOperation = 'source-over';

    } catch(e) {
        console.error("Failed to parse or draw drawing data", e);
    }
};


// --- Components ---

const Toolbar: React.FC<{
    styles: SermonNote['styles'];
    activeStyles: Partial<SermonNote['styles']>;
    onApplyStyle: (type: 'font' | 'size' | 'color', value: string) => void;
    drawingTool: DrawingTool;
    setDrawingTool: (tool: DrawingTool) => void;
    penColor: string;
    setPenColor: (color: string) => void;
    penThickness: number;
    setPenThickness: (thickness: number) => void;
    clearDrawing: () => void;
}> = ({ styles, activeStyles, onApplyStyle, drawingTool, setDrawingTool, penColor, setPenColor, penThickness, setPenThickness, clearDrawing }) => {
    
    const handleToolToggle = (tool: 'pen' | 'eraser') => {
        setDrawingTool(drawingTool === tool ? null : tool);
    };

    const currentFontValue = useMemo(() => {
        const family = activeStyles.fontFamily || styles.fontFamily;
        const weight = activeStyles.fontWeight || styles.fontWeight;
        return `${family},${weight}`;
    }, [activeStyles, styles]);

    const currentSizeValue = useMemo(() => activeStyles.fontSize || styles.fontSize, [activeStyles, styles]);

    const rgbToHex = (rgb: string) => {
        if (!rgb || !rgb.startsWith('rgb')) return rgb;
        const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
        if (!result) return rgb;
        const r = parseInt(result[1], 10);
        const g = parseInt(result[2], 10);
        const b = parseInt(result[3], 10);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase()}`;
    };

    const currentTextColor = useMemo(() => {
        return rgbToHex(activeStyles.color || styles.color || '#212529');
    }, [activeStyles.color, styles.color]);

    return (
        <div className="toolbar">
             <select
                value={currentFontValue}
                onChange={(e) => onApplyStyle('font', e.target.value)}
                aria-label="Font Family"
            >
                {FONT_FAMILIES.map(font => <option key={font.name} value={font.value}>{font.name}</option>)}
            </select>
             <select
                value={currentSizeValue}
                onChange={(e) => onApplyStyle('size', e.target.value)}
                aria-label="Font Size"
            >
                {FONT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <div className="color-palette">
                {TEXT_COLORS.map(color => (
                    <button
                        key={color}
                        className={`color-swatch ${currentTextColor === color ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => onApplyStyle('color', color)}
                        aria-label={`Text color ${color}`}
                    />
                ))}
            </div>
            <div className="pen-options">
                <button className={`btn-tool ${drawingTool === 'pen' ? 'active' : ''}`} onClick={() => handleToolToggle('pen')} title="펜">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293z"/></svg>
                </button>
                <button className={`btn-tool ${drawingTool === 'eraser' ? 'active' : ''}`} onClick={() => handleToolToggle('eraser')} title="지우개">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828zm2.121.707a1 1 0 0 0-1.414 0L4.16 7.547l5.293 5.293 4.633-4.633a1 1 0 0 0 0-1.414zM8.746 13.547 3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293z"/></svg>
                </button>
                {drawingTool === 'pen' && (
                    <>
                        <div className="color-palette">
                            {PEN_COLORS.map(color => (
                                <button
                                    key={color}
                                    className={`color-swatch ${penColor === color ? 'active' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setPenColor(color)}
                                    aria-label={`Pen color ${color}`}
                                />
                            ))}
                        </div>
                    </>
                )}
                {drawingTool && (
                     <>
                        <select value={penThickness} onChange={(e) => setPenThickness(Number(e.target.value))} aria-label="Brush Thickness">
                            {PEN_THICKNESSES.map(thickness => <option key={thickness} value={thickness}>{thickness}px</option>)}
                        </select>
                        <button onClick={clearDrawing} className="btn-secondary" title="Clear All Drawings">모두 지우기</button>
                     </>
                )}
            </div>
        </div>
    );
};

const PageComponent: React.FC<{ page: Page; styles: SermonNote['styles'] }> = ({ page, styles }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const pageEl = pageRef.current;
        if (canvas && pageEl) {
            const { width, height } = pageEl.getBoundingClientRect();
            canvas.width = width;
            canvas.height = height;
            drawOnCanvas(canvas, page.drawingData);
        }
    }, [page.drawingData, page.content]);

    const pageStyle: CSSProperties = {
        fontFamily: styles.fontFamily,
        fontWeight: styles.fontWeight,
        fontSize: styles.fontSize,
        color: styles.color,
    };

    return (
        <div className="presentation-page" ref={pageRef} style={pageStyle}>
            <div className="presentation-content" dangerouslySetInnerHTML={{ __html: page.content }} />
            <canvas ref={canvasRef} className="presentation-drawing-canvas" />
        </div>
    );
};

const PresentationMode: React.FC<{ note: SermonNote; onClose: () => void }> = ({ note, onClose }) => {
    const [pages, setPages] = useState<Page[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const touchStartX = useRef(0);

    const paginateContent = useCallback(() => {
        if (!note || !note.content) {
            setPages([]);
            return;
        }
        const newPages = note.content.map((content, index) => ({
            content,
            drawingData: note.drawingData[index] || '',
        }));
        setPages(newPages);
    }, [note]);

    useEffect(() => {
        paginateContent();
    }, [paginateContent]);

    const goToNext = useCallback(() => {
        setCurrentPage(p => Math.min(p + 1, pages.length - 1));
    }, [pages.length]);

    const goToPrev = useCallback(() => {
        setCurrentPage(p => Math.max(p - 1, 0));
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'ArrowLeft') goToPrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrev, onClose]);
    
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === 0) return;
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX.current - touchEndX;
        if (diff > 50) goToNext();
        else if (diff < -50) goToPrev();
        touchStartX.current = 0;
    };

    return (
        <div className="presentation-overlay" role="dialog" aria-modal="true">
            <button onClick={onClose} className="presentation-close-btn" aria-label="Close Presentation">&times;</button>
            {pages.length > 1 && (
                <>
                    <button onClick={goToPrev} disabled={currentPage === 0} className="presentation-nav-btn left" aria-label="Previous Page">&#8249;</button>
                    <button onClick={goToNext} disabled={currentPage === pages.length - 1} className="presentation-nav-btn right" aria-label="Next Page">&#8250;</button>
                    <div className="presentation-page-indicator" aria-live="polite">{currentPage + 1} / {pages.length}</div>
                </>
            )}

            <div 
              className="presentation-page-container" 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
                {pages.length > 0 ? (
                    <div className="presentation-flipper" style={{ transform: `translateX(-${currentPage * 100}%)`}}>
                       {pages.map((page, index) => (
                           <PageComponent key={index} page={page} styles={note.styles} />
                       ))}
                    </div>
                ) : (
                   <div style={{width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white'}}>노트 내용이 없습니다.</div>
                )}
            </div>
        </div>
    );
};


const NoteListModal: React.FC<{
    notes: SermonNote[];
    onSelect: (noteId: string) => void;
    onClose: () => void;
}> = ({ notes, onSelect, onClose }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>노트 목록</h2>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                <div className="modal-body">
                    <ul className="modal-list">
                        {notes.length > 0 ? notes.map(note => (
                            <li key={note.id} onClick={() => onSelect(note.id)}>
                                <div><strong>{note.title || '제목 없음'}</strong> ({note.date})</div>
                                <div className="passage">{note.passage}</div>
                            </li>
                        )) : <li>저장된 노트가 없습니다.</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const EditablePage: React.FC<{
    pageIndex: number;
    content: string;
    drawingData: string;
    styles: SermonNote['styles'];
    drawingTool: DrawingTool;
    penColor: string;
    penThickness: number;
    onContentChange: (pageIndex: number, newContent: string) => void;
    onDrawingChange: (pageIndex: number, newDrawingData: string) => void;
    editorNodeRef: (node: HTMLDivElement | null) => void;
}> = ({ pageIndex, content, drawingData, styles, drawingTool, penColor, penThickness, onContentChange, onDrawingChange, editorNodeRef }) => {
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lines, setLines] = useState<any[]>([]);

    useEffect(() => {
        try {
            setLines(drawingData ? JSON.parse(drawingData) : []);
        } catch(e) {
            setLines([]);
        }
    }, [drawingData]);
    
    const editorRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if(editorNodeRef) {
            editorNodeRef(editorRef.current);
        }
    }, [editorNodeRef]);


    useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }, [content]);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        const resizeCanvas = () => {
            if (canvas && wrapper) {
                canvas.width = wrapper.clientWidth;
                canvas.height = wrapper.clientHeight;
                drawOnCanvas(canvas, drawingData);
            }
        };
        resizeCanvas();
        const resizeObserver = new ResizeObserver(resizeCanvas);
        if (wrapper) resizeObserver.observe(wrapper);
        return () => resizeObserver.disconnect();
    }, [drawingData]);

    const getRelativeCoords = (event: MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
        const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
        if (!drawingTool) return;
        event.preventDefault();
        setIsDrawing(true);
        const { x, y } = getRelativeCoords(event.nativeEvent);

        const newLine = {
            tool: drawingTool,
            points: [{ x, y }],
            color: penColor,
            thickness: penThickness,
        };
        setLines(prevLines => [...prevLines, newLine]);
    };

    const draw = (event: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !drawingTool) return;
        event.preventDefault();
        const { x, y } = getRelativeCoords(event.nativeEvent);

        setLines(prevLines => {
            const newLines = [...prevLines];
            if (newLines.length > 0) {
              newLines[newLines.length - 1].points.push({ x, y });
            }
            return newLines;
        });
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const newDrawingData = JSON.stringify(lines);
        if (drawingData !== newDrawingData) {
            onDrawingChange(pageIndex, newDrawingData);
        }
    };

    const noteContentStyle: CSSProperties = {
        ...styles,
        backgroundColor: 'transparent',
        position: 'relative',
        zIndex: 0,
    };
    
    const eraserCursor = useMemo(() => {
        const size = Math.max(penThickness, 4);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1.5}" fill="rgba(255,255,255,0.5)" stroke="black" stroke-width="1.5"/></svg>`;
        return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${size/2} ${size/2}, auto`;
    }, [penThickness]);

    const dynamicPageStyle: CSSProperties = {
        cursor: drawingTool === 'eraser' 
            ? eraserCursor 
            : (drawingTool === 'pen' ? 'crosshair' : 'auto'),
    };

    return (
        <div 
            ref={wrapperRef} 
            className={`editable-page ${drawingTool ? 'drawing-active' : ''} ${drawingTool === 'eraser' ? 'eraser-mode' : ''}`}
            style={dynamicPageStyle}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
        >
            <div
                ref={editorRef}
                className="note-content"
                style={noteContentStyle}
                contentEditable={!drawingTool}
                onInput={(e) => onContentChange(pageIndex, e.currentTarget.innerHTML)}
                data-page-index={pageIndex}
                data-placeholder="여기에 설교 노트를 작성하세요..."
                role="textbox"
                aria-multiline="true"
            />
            <canvas ref={canvasRef} className="drawing-canvas" />
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [notes, setNotes] = useState<SermonNote[]>([]);
    const [currentNote, setCurrentNote] = useState<SermonNote | null>(null);
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [drawingTool, setDrawingTool] = useState<DrawingTool>(null);
    const [penColor, setPenColor] = useState(PEN_COLORS[0]);
    const [penThickness, setPenThickness] = useState(PEN_THICKNESSES[1]);
    const [isPresentationMode, setPresentationMode] = useState(false);
    const [isNoteListModalOpen, setNoteListModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeStyles, setActiveStyles] = useState<Partial<SermonNote['styles']>>({});
    const editorRefs = useRef(new Map<number, HTMLDivElement | null>());
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const importInputRef = useRef<HTMLInputElement>(null);
    
    // Load notes from local storage on initial render
    useEffect(() => {
        try {
            const savedNotes = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedNotes) {
                const parsedNotes = JSON.parse(savedNotes).map((note: any) => {
                    // Migration for old notes
                    if (typeof note.content === 'string' || !note.content) {
                        note.content = [note.content || ''];
                        note.drawingData = [note.drawingData || ''];
                    }
                    if (!note.drawingData || note.drawingData.length !== note.content.length) {
                        const newDrawingData = [];
                        for (let i = 0; i < note.content.length; i++) {
                            newDrawingData.push(note.drawingData?.[i] || '');
                        }
                        note.drawingData = newDrawingData;
                    }
                    return note as SermonNote;
                });
                setNotes(parsedNotes);
                if (parsedNotes.length > 0) {
                    setCurrentNote(parsedNotes[0]);
                } else {
                    setCurrentNote(createNewNote());
                }
            } else {
                const newNote = createNewNote();
                setNotes([newNote]);
                setCurrentNote(newNote);
            }
        } catch (error) {
            console.error("Failed to load notes from local storage:", error);
            const newNote = createNewNote();
            setNotes([newNote]);
            setCurrentNote(newNote);
        } finally {
            setIsInitialLoad(false);
        }
    }, []);

    // Autosave notes to local storage
    useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
            } catch (error) {
                console.error("Failed to save notes to local storage:", error);
            }
        }
    }, [notes, isInitialLoad]);

    useLayoutEffect(() => {
        if (!currentNote) return;

        const editor = editorRefs.current.get(activePageIndex);
        if (!editor || editor.scrollHeight <= editor.clientHeight) {
            return;
        }

        const editorRect = editor.getBoundingClientRect();
        // Use a point slightly inside the bottom padding to find the split point
        const splitPoint = { x: editorRect.left + 32, y: editorRect.bottom - 24 };

        // @ts-ignore - document.caretRangeFromPoint is not in all TS libs yet
        const splitRange = document.caretRangeFromPoint ? document.caretRangeFromPoint(splitPoint.x, splitPoint.y) : null;
        
        if (!splitRange) {
            console.warn("Could not determine split point for autopagination.");
            return; 
        }

        const overflowRange = document.createRange();
        overflowRange.setStart(splitRange.startContainer, splitRange.startOffset);
        overflowRange.setEnd(editor, editor.childNodes.length);

        const fragment = overflowRange.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        const overflowingHtml = tempDiv.innerHTML;
        if (!overflowingHtml.trim()) {
            return;
        }

        const currentPageHtml = editor.innerHTML;

        setCurrentNote(prevNote => {
            if (!prevNote) return null;
            const newContent = [...prevNote.content];
            const newDrawingData = [...prevNote.drawingData];
            
            newContent[activePageIndex] = currentPageHtml;

            if (activePageIndex + 1 < newContent.length) {
                newContent[activePageIndex + 1] = overflowingHtml + newContent[activePageIndex + 1];
            } else {
                newContent.push(overflowingHtml);
                newDrawingData.push('');
            }
            
            return { ...prevNote, content: newContent, drawingData: newDrawingData };
        });

        // Move to the next page to continue typing
        setActivePageIndex(p => p + 1);

    }, [currentNote?.content, activePageIndex]);

    const handleNoteChange = (field: keyof Omit<SermonNote, 'styles' | 'content' | 'drawingData'>, value: string) => {
        if (!currentNote) return;
        const updatedNote = { ...currentNote, [field]: value };
        setCurrentNote(updatedNote);
        setNotes(notes.map(n => n.id === currentNote.id ? updatedNote : n));
    };

    const handleContentChange = (pageIndex: number, value: string) => {
        if (!currentNote) return;
    
        const newContent = [...currentNote.content];
        newContent[pageIndex] = value;
    
        const updatedNote = { ...currentNote, content: newContent };
        setCurrentNote(updatedNote);
        setNotes(notes.map(n => n.id === currentNote.id ? updatedNote : n));
    };
    
    const handleDrawingChange = (index: number, value: string) => {
        if (!currentNote) return;
        const updatedDrawingData = [...currentNote.drawingData];
        updatedDrawingData[index] = value;
        const updatedNote = { ...currentNote, drawingData: updatedDrawingData };
        setCurrentNote(updatedNote);
        setNotes(notes.map(n => n.id === currentNote.id ? updatedNote : n));
    };
    
    const handleApplyStyle = (type: 'font' | 'size' | 'color', value: string) => {
        if (!currentNote) return;
    
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const editor = (container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement)?.closest('.note-content');
        if (!editor) return;
    
        const newSpan = document.createElement('span');
        if (type === 'font') {
            const [family, weight] = value.split(',');
            newSpan.style.fontFamily = family;
            newSpan.style.fontWeight = weight;
        } else if (type === 'size') {
            newSpan.style.fontSize = value;
        } else if (type === 'color') {
            newSpan.style.color = value;
        }
    
        try {
            const selectedFragment = range.extractContents();
            newSpan.appendChild(selectedFragment);
            range.insertNode(newSpan);
    
            const pageIndex = Number(editor.getAttribute('data-page-index'));
            handleContentChange(pageIndex, editor.innerHTML);
    
            selection.removeAllRanges();
            range.selectNodeContents(newSpan);
            selection.addRange(range);
        } catch (e) {
            console.error("Error applying style:", e);
        }
    };

    const handleSelectionChange = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            setActiveStyles({});
            return;
        }

        const anchorNode = selection.anchorNode;
        if (!anchorNode) {
            setActiveStyles({});
            return;
        }
        
        const container = anchorNode;
        const editor = (container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement)?.closest('.note-content');
        if (!editor) {
            setActiveStyles({});
            return;
        }

        const element = anchorNode.nodeType === Node.ELEMENT_NODE ? anchorNode as Element : anchorNode.parentElement;
        if (element) {
            const computedStyle = window.getComputedStyle(element);
            const computedFamilies = computedStyle.fontFamily.split(',').map(f => f.replace(/"/g, '').trim());

            const matchedFamily = FONT_FAMILIES.find(f => {
                const [familyName] = f.value.split(',');
                return computedFamilies.includes(familyName);
            });

            const fontFamily = matchedFamily ? matchedFamily.value.split(',')[0] : computedFamilies[0];
            const fontWeight = matchedFamily ? matchedFamily.value.split(',')[1] : computedStyle.fontWeight;

            const newStyles: Partial<SermonNote['styles']> = {
                fontFamily,
                fontWeight,
                fontSize: computedStyle.fontSize,
                color: computedStyle.color,
            };

            setActiveStyles(prev => {
                if (prev.fontFamily !== newStyles.fontFamily || prev.fontWeight !== newStyles.fontWeight || prev.fontSize !== newStyles.fontSize || prev.color !== newStyles.color) {
                    return newStyles;
                }
                return prev;
            });
        }
    }, []);

    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [handleSelectionChange]);

    const handleNewNote = () => {
        const newNote = createNewNote();
        const newNotes = [newNote, ...notes];
        setNotes(newNotes);
        setCurrentNote(newNote);
        setDrawingTool(null);
        setActivePageIndex(0);
    };

    const handleSelectNote = (noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            setCurrentNote(note);
            setActivePageIndex(0);
        }
        setNoteListModalOpen(false);
    };
    
    const exportNotes = () => {
        if (notes.length === 0) {
            alert('내보낼 노트가 없습니다.');
            return;
        }
        const json = JSON.stringify(notes, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sermon-notes-backup.json';
        a.click();
        URL.revokeObjectURL(url);
    };
    
    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const importNotes = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target?.result as string);
                if(Array.isArray(importedData)) {
                    const importedNotes = importedData.map((note: any) => {
                        if (typeof note.content === 'string' || !note.content) {
                            note.content = [note.content || ''];
                            note.drawingData = [note.drawingData || ''];
                        }
                        return note as SermonNote;
                    });
                     if (importedNotes.length > 0 && !('id' in importedNotes[0] && 'title' in importedNotes[0])) {
                         throw new Error("Invalid note format");
                    }
                    setNotes(importedNotes);
                    if(importedNotes.length > 0) {
                        setCurrentNote(importedNotes[0]);
                    } else {
                       const newNote = createNewNote();
                       setNotes([newNote]);
                       setCurrentNote(newNote);
                    }
                    setActivePageIndex(0);
                    alert(`${importedNotes.length}개의 노트를 가져왔습니다.`);
                } else {
                    throw new Error("Not an array");
                }
            } catch (error) {
                alert("유효하지 않은 파일입니다.");
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    };
    
    const clearDrawing = () => {
        if (!currentNote) return;
        if(window.confirm('현재 페이지의 그리기를 지우시겠습니까?')) {
            const updatedDrawingData = [...currentNote.drawingData];
            updatedDrawingData[activePageIndex] = '';
            const updatedNote = { ...currentNote, drawingData: updatedDrawingData };
            setCurrentNote(updatedNote);
            setNotes(notes.map(n => n.id === currentNote.id ? updatedNote : n));
        }
    };

    const filteredNotes = notes.filter(note => {
        const contentString = Array.isArray(note.content) ? note.content.join(' ') : note.content;
        return note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
               note.passage.toLowerCase().includes(searchTerm.toLowerCase()) ||
               contentString.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (!currentNote) {
        return <div>Loading...</div>;
    }

    return (
        <div className="app-container">
            <header className="header">
                 <h1 className="app-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.473 2.412a.5.5 0 0 0-.946 0l-1 3A.5.5 0 0 0 9 6h2a.5.5 0 0 0 .473-.588l-1-3zM8 8.5a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-1 0V9a.5.5 0 0 1 .5-.5zm0 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM8 5c.45 0 .82.293 1.028.714.03.065.054.132.073.203l1.243 4.143a.64.64 0 0 1-.018.523A1.499 1.499 0 0 1 10.243 11H5.757a1.5 1.5 0 0 1-1.324-2.285l1.243-4.143a1.63 1.63 0 0 1 .073-.203A1.5 1.5 0 0 1 8 5zm0-3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                    설교노트
                </h1>
            </header>

            <div className="main-actions-toolbar">
                <div className="action-group">
                    <button onClick={handleNewNote}>새 노트</button>
                    <button onClick={() => setNoteListModalOpen(true)}>목록</button>
                </div>
                 <div className="search-container">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
                    <input 
                        type="text" 
                        placeholder="노트 검색..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
                <div className="action-group-right">
                    <button onClick={() => setPresentationMode(true)} className="btn-presentation">전체화면 보기</button>
                    <button onClick={() => alert('성경보기 기능은 준비중입니다.')} className="btn-secondary">성경보기</button>
                    <button onClick={handleImportClick} className="btn-secondary">가져오기</button>
                    <input type="file" ref={importInputRef} accept=".json" onChange={importNotes} style={{display: 'none'}}/>
                    <button onClick={exportNotes} className="btn-secondary">내보내기</button>
                </div>
            </div>

            <main>
                <div className="metadata-grid">
                    <div className="form-group">
                        <label htmlFor="title">설교제목</label>
                        <input type="text" id="title" value={currentNote.title} onChange={(e) => handleNoteChange('title', e.target.value)} />
                    </div>
                     <div className="form-group">
                        <label htmlFor="passage">성경본문</label>
                        <input type="text" id="passage" value={currentNote.passage} onChange={(e) => handleNoteChange('passage', e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="date">날짜</label>
                        <div className="form-group-inline">
                            <input type="date" id="date" value={currentNote.date} onChange={(e) => handleNoteChange('date', e.target.value)} />
                            <span className="day-of-week">{getDayOfWeek(currentNote.date)}</span>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="serviceType">예배</label>
                        <select id="serviceType" value={currentNote.serviceType} onChange={(e) => handleNoteChange('serviceType', e.target.value)}>
                            {SERVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                </div>

                <Toolbar 
                    styles={currentNote.styles}
                    activeStyles={activeStyles}
                    onApplyStyle={handleApplyStyle}
                    drawingTool={drawingTool}
                    setDrawingTool={setDrawingTool}
                    penColor={penColor}
                    setPenColor={setPenColor}
                    penThickness={penThickness}
                    setPenThickness={setPenThickness}
                    clearDrawing={clearDrawing}
                />

                <div className="editor-pages-container">
                    <EditablePage
                        key={`${currentNote.id}-${activePageIndex}`}
                        pageIndex={activePageIndex}
                        content={currentNote.content[activePageIndex] || ''}
                        drawingData={currentNote.drawingData?.[activePageIndex] || ''}
                        styles={currentNote.styles}
                        drawingTool={drawingTool}
                        penColor={penColor}
                        penThickness={penThickness}
                        onContentChange={handleContentChange}
                        onDrawingChange={handleDrawingChange}
                        editorNodeRef={node => {
                            if (node) editorRefs.current.set(activePageIndex, node);
                            else editorRefs.current.delete(activePageIndex);
                        }}
                    />
                </div>
                
                <div className="page-controls">
                    <button onClick={() => setActivePageIndex(p => Math.max(0, p - 1))} disabled={activePageIndex === 0}>&lt; 이전</button>
                    <span>{activePageIndex + 1} / {currentNote.content.length}</span>
                    <button onClick={() => setActivePageIndex(p => Math.min(currentNote.content.length - 1, p + 1))} disabled={activePageIndex >= currentNote.content.length - 1}>다음 &gt;</button>
                </div>

                <div className="actions">
                     <button onClick={exportNotes} className="btn-save">내보내기</button>
                </div>
            </main>
            
            {isPresentationMode && <PresentationMode note={currentNote} onClose={() => setPresentationMode(false)} />}
            
            {isNoteListModalOpen && <NoteListModal notes={filteredNotes} onSelect={handleSelectNote} onClose={() => setNoteListModalOpen(false)} />}
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);