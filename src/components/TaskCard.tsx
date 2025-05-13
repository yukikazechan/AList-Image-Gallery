
import { useState } from "react";
import { Task } from "../types/task";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

interface TaskCardProps {
  task: Task;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

const TaskCard = ({ task, onToggleComplete, onDelete }: TaskCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleToggle = () => {
    onToggleComplete(task.id, !task.completed);
  };
  
  return (
    <Card 
      className={`p-4 mb-3 border-l-4 ${task.completed 
        ? "border-l-gray-300 bg-gray-50" 
        : "border-l-task hover:border-l-task-hover"} 
        transition-all duration-200 hover:shadow-md`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        <Checkbox 
          checked={task.completed} 
          onCheckedChange={handleToggle}
          className={task.completed 
            ? "border-gray-400" 
            : "border-task hover:border-task-hover"} 
        />
        <div className="flex-1">
          <h3 className={`font-medium text-base ${task.completed 
            ? "text-gray-500 animate-task-complete" 
            : "text-gray-900"}`}>
            {task.title}
          </h3>
          
          {task.description && (
            <p className={`text-sm mt-1 ${task.completed 
              ? "text-gray-400" 
              : "text-gray-600"}`}>
              {task.description}
            </p>
          )}
          
          <div className="flex justify-between items-center mt-2">
            {task.dueDate && (
              <span className={`text-xs ${
                task.completed 
                  ? "text-gray-400" 
                  : new Date() > task.dueDate 
                    ? "text-red-500" 
                    : "text-gray-500"
              }`}>
                Due: {format(task.dueDate, "MMM d, yyyy")}
              </span>
            )}
            
            {isHovered && (
              <button 
                onClick={() => onDelete(task.id)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TaskCard;
