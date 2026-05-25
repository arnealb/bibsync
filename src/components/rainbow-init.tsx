"use client";

import { useEffect } from "react";

import { initRainbow } from "@/lib/rainbow";

/** Restores rainbow mode from localStorage on load. */
export function RainbowInit() {
  useEffect(() => {
    initRainbow();
  }, []);
  return null;
}
