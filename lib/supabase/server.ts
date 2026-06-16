import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client สำหรับฝั่ง server (server components / route handlers)
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // เรียกจาก server component — เซ็ต cookie ไม่ได้ ปล่อยผ่าน (middleware refresh ให้)
          }
        },
      },
    }
  );
}
