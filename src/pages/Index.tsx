
import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Task } from "../types/task";
import TaskList from "../components/TaskList";
import TaskForm from "../components/TaskForm";
import { toast } from "sonner";

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    // Load tasks from localStorage if available
    const savedTasks = localStorage.getItem("tasks");
    return savedTasks ? JSON.parse(savedTasks) : [
      {
        id: uuidv4(),
        title: "Welcome to TaskMaster!",
        description: "This is a sample task. Create your own tasks or mark this as complete.",
        completed: false,
        createdAt: new Date(),
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      }
    ];
  });

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (taskData: Omit<Task, "id" | "completed" | "createdAt">) => {
    const newTask: Task = {
      id: uuidv4(),
      ...taskData,
      completed: false,
      createdAt: new Date(),
    };
    
    setTasks([newTask, ...tasks]);
  };

  const toggleComplete = (id: string, completed: boolean) => {
    setTasks(
      tasks.map((task) => {
        if (task.id === id) {
          const updatedTask = { ...task, completed };
          
          if (completed) {
            toast.success("Task completed!");
          }
          
          return updatedTask;
        }
        return task;
      })
    );
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((task) => task.id !== id));
    toast.success("Task deleted");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-2xl py-8 px-4">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-task mb-2">TaskMaster</h1>
          <p className="text-gray-600">Organize your day, achieve your goals</p>
        </header>
        
        <main>
          <TaskForm onAddTask={addTask} />
          <TaskList 
            tasks={tasks} 
            onToggleComplete={toggleComplete} 
            onDelete={deleteTask} 
          />
        </main>
        
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>TaskMaster &copy; 2023</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
