import { useEffect } from "react";
import { useLocation } from "wouter";

export default function EmployeeMorePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/employee/documents");
  }, [setLocation]);

  return null;
}
