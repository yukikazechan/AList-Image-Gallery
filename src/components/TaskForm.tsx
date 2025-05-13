
import { useState } from "react";
import { Task } from "../types/task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface TaskFormProps {
  onAddTask: (task: Omit<Task, "id" | "completed" | "createdAt">) => void;
}

const TaskForm = ({ onAddTask }: TaskFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("Task title cannot be empty");
      return;
    }
    
    onAddTask({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
    
    setTitle("");
    setDescription("");
    setDueDate("");
    setIsFormOpen(false);
    
    toast.success("Task created successfully!");
  };
  
  if (!isFormOpen) {
    return (
      <Button
        onClick={() => setIsFormOpen(true)}
        className="w-full bg-task hover:bg-task-hover text-white mb-6"
      >
        + Add New Task
      </Button>
    );
  }

  return (
    <Card className="p-4 mb-6 border-l-4 border-l-task animate-fade-in">
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          <div>
            <Input
              type="text"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full"
              autoFocus
            />
          </div>
          
          <div>
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none"
              rows={2}
            />
          </div>
          
          <div>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setIsFormOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="bg-task hover:bg-task-hover"
            >
              Add Task
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
};

export default TaskForm;
