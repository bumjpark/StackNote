import React, { useState, useMemo } from 'react';
import { createReactBlockSpec } from "@blocknote/react";
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

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
const LargeCalendarBlockContent: React.FC<{ block: any, editor: any }> = ({ block, editor }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // States for inline input form
  const [addingToDate, setAddingToDate] = useState<string | null>(null);
  const [newTodoText, setNewTodoText] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const events: Record<string, ToDo[]> = block.props.events || {};

  const updateEvents = (updatedEvents: Record<string, ToDo[]>) => {
    editor.updateBlock(block, {
      props: { ...block.props, events: JSON.stringify(updatedEvents) }
    });
  };

  const submitToDo = (dateStr: string) => {
    if (!newTodoText.trim()) {
      setAddingToDate(null);
      return;
    }

    const newToDo: ToDo = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTodoText.trim(),
      completed: false,
    };

    const updatedEvents = { ...events };
    if (!updatedEvents[dateStr]) updatedEvents[dateStr] = [];
    updatedEvents[dateStr] = [...updatedEvents[dateStr], newToDo];

    updateEvents(updatedEvents);
    setNewTodoText("");
    setAddingToDate(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, dateStr: string) => {
    if (e.key === 'Enter') {
      submitToDo(dateStr);
    } else if (e.key === 'Escape') {
      setAddingToDate(null);
      setNewTodoText("");
    }
  };

  const toggleToDo = (e: React.MouseEvent, dateStr: string, id: string) => {
    e.stopPropagation();
    const updatedEvents = { ...events };
    updatedEvents[dateStr] = updatedEvents[dateStr].map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    updateEvents(updatedEvents);
  };

  const deleteToDo = (e: React.MouseEvent, dateStr: string, id: string) => {
    e.stopPropagation();
    const updatedEvents = { ...events };
    updatedEvents[dateStr] = updatedEvents[dateStr].filter(todo => todo.id !== id);
    updateEvents(updatedEvents);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const days = useMemo(() => {
    const d = [];
    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
        d.push(<div key={`prev-${i}`} className="large-calendar-day empty"></div>);
    }
    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = todayStr === dateStr;
        const dayEvents = events[dateStr] || [];
        const isAddingHere = addingToDate === dateStr;
      
        d.push(
            <div key={day} className={`large-calendar-day ${isToday ? 'today' : ''}`} >
                <div className="day-header">
                    <span className="day-number">{day}</span>
                    <button className="add-quick-btn" onClick={(e) => {
                        e.stopPropagation();
                        setAddingToDate(dateStr);
                    }}><Plus size={14} /></button>
                </div>
                <div className="day-content">
                    {dayEvents.map(todo => (
                        <div key={todo.id} className={`todo-pill ${todo.completed ? 'completed' : ''}`}>
                            <div className="todo-pill-click" onClick={(e) => toggleToDo(e, dateStr, todo.id)}>
                                {todo.text}
                            </div>
                            <span className="delete-pill" onClick={(e) => deleteToDo(e, dateStr, todo.id)}><Trash2 size={12}/></span>
                        </div>
                    ))}
                    {isAddingHere && (
                        <div className="inline-add">
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="새 할일" 
                                value={newTodoText}
                                onChange={(e) => setNewTodoText(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, dateStr)}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return d;
  }, [year, month, events, addingToDate, newTodoText]);

  return (
    <div className="large-calendar-container" contentEditable={false}>
      <style>{`
        .large-calendar-container {
          background: #1a1b1e;
          border: 1px solid #2c2e33;
          border-radius: 12px;
          padding: 20px;
          color: #c1c2c5;
          width: 100%;
          margin: 1.5rem 0;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
          font-family: inherit;
        }
        .large-calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .large-calendar-header h2 {
          margin: 0;
          font-weight: 700;
          font-size: 1.4rem;
          color: #fff;
        }
        .large-nav-btn {
          background: transparent;
          border: 1px solid #373A40;
          color: #c1c2c5;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .large-nav-btn:hover {
          background: #2c2e33;
          color: #fff;
        }
        .header-actions {
            display: flex;
            gap: 8px;
        }
        .large-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 0.85rem;
          font-weight: 600;
          color: #909296;
          margin-bottom: 10px;
        }
        .large-days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: #2c2e33;
          border: 1px solid #2c2e33;
          border-radius: 8px;
          overflow: hidden;
        }
        .large-calendar-day {
          background: #1a1b1e;
          min-height: 120px;
          padding: 8px;
          display: flex;
          flex-direction: column;
        }
        .large-calendar-day.empty {
          background: #141517;
        }
        .day-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }
        .day-number {
            font-size: 0.9rem;
            font-weight: 500;
            color: #c1c2c5;
        }
        .large-calendar-day.today .day-number {
            background: #228be6;
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .add-quick-btn {
            background: transparent;
            border: none;
            color: #5c5f66;
            cursor: pointer;
            padding: 2px;
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.2s, background 0.2s;
        }
        .large-calendar-day:hover .add-quick-btn {
            opacity: 1;
        }
        .add-quick-btn:hover {
            background: #2c2e33;
            color: #c1c2c5;
        }
        .day-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            overflow-y: auto;
        }
        /* Hide scrollbar for neatness */
        .day-content::-webkit-scrollbar {
            width: 0px;
            background: transparent;
        }
        .todo-pill {
            background: #1c7cd6; /* Blue for tasks */
            color: white;
            font-size: 0.75rem;
            padding: 4px 6px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            white-space: nowrap;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            transition: opacity 0.2s;
            cursor: pointer;
        }
        .todo-pill-click {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
        }
        .todo-pill.completed {
            background: #2c2e33;
            color: #909296;
            text-decoration: line-through;
        }
        .delete-pill {
            opacity: 0;
            cursor: pointer;
            padding-left: 4px;
        }
        .todo-pill:hover .delete-pill {
            opacity: 1;
        }
        .inline-add input {
            width: 100%;
            background: #2c2e33;
            border: 1px solid #373A40;
            color: #fff;
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 0.75rem;
            outline: none;
            box-sizing: border-box;
        }
        .inline-add input:focus {
            border-color: #228be6;
        }
      `}</style>
      
      <div className="large-calendar-header">
        <h2>{year}년 {month + 1}월</h2>
        <div className="header-actions">
           <button className="large-nav-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
           <button className="large-nav-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="large-weekdays">
        <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
      </div>
      <div className="large-days-grid">
        {days}
      </div>
    </div>
  );
};

export const LargeCalendarBlock = createReactBlockSpec(
  {
    type: "large_calendar",
    propSchema: {
      events: { default: "{}" },
    },
    content: "none",
  },
  {
    render: (props) => {
      let parsedEvents = {};
      try {
        const eventsProp = props.block.props.events;
        parsedEvents = typeof eventsProp === 'string' ? JSON.parse(eventsProp) : (eventsProp || {});
      } catch (e) {
        console.error("Failed to parse large calendar events:", e);
      }

      const block = {
        ...props.block,
        props: {
          ...props.block.props,
          events: parsedEvents
        }
      };
      return <LargeCalendarBlockContent block={block} editor={props.editor} />;
    },
  }
);
