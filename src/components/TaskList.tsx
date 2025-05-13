
import { useState } from "react";
import { Task } from "../types/task";
import TaskCard from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

const TaskList = ({ tasks, onToggleComplete, onDelete }: TaskListProps) => {
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  
  const filteredTasks = tasks.filter(task => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });
  
  const activeTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);

  return (
    <div>
      <Tabs defaultValue="all" className="w-full mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger 
            value="all" 
            onClick={() => setFilter("all")}
            className="data-[state=active]:bg-task-light data-[state=active]:text-task"
          >
            All ({tasks.length})
          </TabsTrigger>
          <TabsTrigger 
            value="active" 
            onClick={() => setFilter("active")}
            className="data-[state=active]:bg-task-light data-[state=active]:text-task"
          >
            Active ({activeTasks.length})
          </TabsTrigger>
          <TabsTrigger 
            value="completed" 
            onClick={() => setFilter("completed")}
            className="data-[state=active]:bg-task-light data-[state=active]:text-task"
          >
            Completed ({completedTasks.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {filter === "all" && "You have no tasks yet. Add your first task!"}
          {filter === "active" && "No active tasks. All caught up!"}
          {filter === "completed" && "No completed tasks yet."}
        </div>
      ) : (
        <div className="space-y-1">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      
      {completedTasks.length > 0 && filter === "completed" && (
        <div className="mt-4 text-right">
          <Button 
            variant="outline" 
            size="sm"
            className="text-gray-500 text-xs"
            onClick={() => {
              completedTasks.forEach(task => onDelete(task.id));
            }}
          >
            Clear completed
          </Button>
        </div>
      )}
    </div>
  );
};

export default TaskList;
