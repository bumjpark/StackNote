import React, { useState, useMemo } from 'react';
import { createReactBlockSpec } from "@blocknote/react";
import { ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle, Circle } from 'lucide-react';

// --- Types ---
interface ToDo {
  id: string;
  text: string;
  completed: boolean;
}

// --- Helper Functions ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

// --- Calendar Logic ---
const CalendarBlockContent: React.FC<{ block: any, editor: any }> = ({ block, editor }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const events: Record<string, ToDo[]> = block.props.events || {};

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  };

  const updateEvents = (updatedEvents: Record<string, ToDo[]>) => {
    editor.updateBlock(block, {
      props: { ...block.props, events: JSON.stringify(updatedEvents) }
    });
  };

  const submitToDo = () => {
    if (!selectedDate || !newTodoText.trim()) {
      setIsAdding(false);
      return;
    }

    const newToDo: ToDo = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTodoText.trim(),
      completed: false,
    };

    const updatedEvents = { ...events };
    if (!updatedEvents[selectedDate]) updatedEvents[selectedDate] = [];
    updatedEvents[selectedDate] = [...updatedEvents[selectedDate], newToDo];

    updateEvents(updatedEvents);
    setNewTodoText("");
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitToDo();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTodoText("");
    }
  };

  const toggleToDo = (id: string) => {
    if (!selectedDate) return;
    const updatedEvents = { ...events };
    updatedEvents[selectedDate] = updatedEvents[selectedDate].map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );

    updateEvents(updatedEvents);
  };

  const deleteToDo = (id: string) => {
    if (!selectedDate) return;
    const updatedEvents = { ...events };
    updatedEvents[selectedDate] = updatedEvents[selectedDate].filter(todo => todo.id !== id);

    updateEvents(updatedEvents);
  };

  const days = useMemo(() => {
    const d = [];
    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      d.push(<div key={`prev-${i}`} className="calendar-day empty"></div>);
    }
    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = selectedDate === dateStr;
      const hasEvents = (events[dateStr] || []).length > 0;
      
      d.push(
        <div
          key={day}
          className={`calendar-day ${isSelected ? 'selected' : ''} ${hasEvents ? 'has-events' : ''}`}
          onClick={() => handleDayClick(day)}
        >
          {day}
          {hasEvents && <div className="event-dot" />}
        </div>
      );
    }
    return d;
  }, [year, month, selectedDate, events]);

  return (
    <div className="calendar-block-container" contentEditable={false}>
      <style>{`
        .calendar-block-container {
          background: #1a1b1e;
          border: 1px solid #2c2e33;
          border-radius: 12px;
          padding: 20px;
          color: #c1c2c5;
          max-width: 700px;
          margin: 1rem 0;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
          display: flex;
          gap: 20px;
          font-family: inherit;
        }
        .calendar-left {
          flex: 1.5;
        }
        .calendar-right {
          flex: 1;
          border-left: 1px solid #2c2e33;
          padding-left: 20px;
          display: flex;
          flex-direction: column;
        }
        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .calendar-header span {
          font-weight: 700;
          font-size: 1.1rem;
          color: #fff;
        }
        .nav-btn {
          background: transparent;
          border: none;
          color: #909296;
          cursor: pointer;
          padding: 5px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .nav-btn:hover {
          background: #2c2e33;
          color: #fff;
        }
        .weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 0.8rem;
          font-weight: 600;
          color: #5c5f66;
          margin-bottom: 10px;
        }
        .days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .calendar-day {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
          position: relative;
        }
        .calendar-day:hover:not(.empty) {
          background: #2c2e33;
        }
        .calendar-day.selected {
          background: #228be6 !important;
          color: #fff;
          font-weight: bold;
        }
        .event-dot {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          background: #40c057;
          border-radius: 50%;
        }
        .todo-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .todo-header h4 {
          margin: 0;
          font-size: 0.95rem;
          color: #fff;
        }
        .todo-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .todo-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          background: #25262b;
          border-radius: 6px;
          font-size: 0.85rem;
          transition: transform 0.1s;
        }
        .todo-item:hover {
          transform: scale(1.02);
        }
        .todo-text {
          flex: 1;
          color: #c1c2c5;
        }
        .todo-text.completed {
          text-decoration: line-through;
          color: #5c5f66;
        }
        .todo-action {
          opacity: 0.3;
          transition: opacity 0.2s;
          cursor: pointer;
        }
        .todo-item:hover .todo-action {
          opacity: 1;
        }
        .add-todo-btn {
          background: #2e2e2e;
          border: 1px dashed #444;
          color: #909296;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
          margin-top: 10px;
        }
        .add-todo-btn:hover {
          background: #3c3c3c;
          border-color: #666;
          color: #fff;
        }
        .inline-input-form {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .inline-input-form input {
          flex: 1;
          background: #25262b;
          border: 1px solid #373A40;
          color: #fff;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          outline: none;
        }
        .inline-input-form input:focus {
          border-color: #228be6;
        }
        .inline-input-form button {
          background: #228be6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0 12px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .inline-input-form button:hover {
          background: #1c7cd6;
        }
        @media (max-width: 600px) {
          .calendar-block-container {
            flex-direction: column;
          }
          .calendar-right {
            border-left: none;
            border-top: 1px solid #2c2e33;
            padding-left: 0;
            padding-top: 20px;
          }
        }
      `}</style>
      
      <div className="calendar-left">
        <div className="calendar-header">
          <button className="nav-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <span>{year}년 {month + 1}월</span>
          <button className="nav-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
        </div>
        <div className="weekdays">
          <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
        </div>
        <div className="days-grid">
          {days}
        </div>
      </div>

      <div className="calendar-right">
        <div className="todo-header">
          <h4>{selectedDate ? `${selectedDate.split('-')[1]}월 ${selectedDate.split('-')[2]}일 일정` : "날짜를 선택하세요"}</h4>
          {selectedDate && !isAdding && <button className="nav-btn" onClick={() => setIsAdding(true)} title="할 일 추가"><Plus size={16} /></button>}
        </div>
        
        <div className="todo-list">
          {selectedDate && (events[selectedDate] || []).length > 0 ? (
            (events[selectedDate] || []).map(todo => (
              <div key={todo.id} className="todo-item">
                <div onClick={() => toggleToDo(todo.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {todo.completed ? <CheckCircle size={16} color="#40c057" /> : <Circle size={16} color="#5c5f66" />}
                </div>
                <span className={`todo-text ${todo.completed ? 'completed' : ''}`}>
                  {todo.text}
                </span>
                <Trash2 size={14} className="todo-action" color="#fa5252" onClick={() => deleteToDo(todo.id)} />
              </div>
            ))
          ) : selectedDate ? (
            <div style={{ fontSize: '0.8rem', color: '#5c5f66', textAlign: 'center', marginTop: '20px' }}>일정이 없습니다.</div>
          ) : null}
        </div>

        {selectedDate && isAdding ? (
          <div className="inline-input-form">
            <input 
              autoFocus
              type="text" 
              placeholder="새로운 할 일..." 
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button onClick={submitToDo}>추가</button>
          </div>
        ) : selectedDate ? (
          <button className="add-todo-btn" onClick={() => setIsAdding(true)}>
            <Plus size={14} /> 할 일 추가하기
          </button>
        ) : null}
      </div>
    </div>
  );
};

export const SmallCalendarBlock = createReactBlockSpec(
  {
    type: "small_calendar",
    propSchema: {
      // Store events as a JSON string to avoid BlockNote's prop type limitations for complex objects
      events: { default: "{}" },
    },
    content: "none",
  },
  {
    render: (props) => {
      // Parse events back to object for the component with safety check
      let parsedEvents = {};
      try {
        const eventsProp = props.block.props.events;
        parsedEvents = typeof eventsProp === 'string' ? JSON.parse(eventsProp) : (eventsProp || {});
      } catch (e) {
        console.error("Failed to parse calendar events:", e);
      }

      const block = {
        ...props.block,
        props: {
          ...props.block.props,
          events: parsedEvents
        }
      };
      return <CalendarBlockContent block={block} editor={props.editor} />;
    },
  }
);
