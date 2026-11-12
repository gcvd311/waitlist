"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export function usePublic() {
  const [data, setData] = useState<{ name: string; mascots: string[] }>({ name: "Crystal", mascots: [] });
  useEffect(() => {
    api<{ name: string; mascots: string[] }>("/api/public").then(setData).catch(() => {});
  }, []);
  return data;
}
