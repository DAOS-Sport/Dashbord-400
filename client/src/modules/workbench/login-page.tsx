import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { KeyRound } from "lucide-react";
import { roleHomePath } from "@shared/auth/me";
import { useLogin } from "@/shared/auth/session";
import { BrandMark } from "@/shared/brand";

export default function WorkbenchLoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("1111");
  const [password, setPassword] = useState("1111");
  const login = useLogin();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate(
      { username, password },
      {
        onSuccess: (session) => setLocation(roleHomePath[session.activeRole]),
      },
    );
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f7fb] p-4 text-[#10233f]">
      <form onSubmit={submit} className="w-full max-w-[420px] rounded-[8px] border border-[#dfe7ef] bg-white p-6 shadow-[0_28px_70px_-42px_rgba(15,34,58,0.45)]">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark className="h-11 w-11 rounded-[8px]" />
          <div>
            <h1 className="text-[22px] font-black">駿斯 CMS</h1>
            <p className="mt-1 text-[13px] font-bold text-[#637185]">全端開發測試登入</p>
          </div>
        </div>

        <label className="block text-[12px] font-black text-[#536175]" htmlFor="username">
          帳號
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-2 h-11 w-full rounded-[8px] border border-[#dfe7ef] px-3 text-[14px] font-bold outline-none focus:border-[#1f6fd1]"
          autoComplete="username"
        />

        <label className="mt-4 block text-[12px] font-black text-[#536175]" htmlFor="password">
          密碼
        </label>
        <input
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 h-11 w-full rounded-[8px] border border-[#dfe7ef] px-3 text-[14px] font-bold outline-none focus:border-[#1f6fd1]"
          type="password"
          autoComplete="current-password"
        />

        {login.error ? (
          <p className="mt-4 rounded-[8px] bg-[#fff0f1] px-3 py-2 text-[12px] font-bold text-[#d43d51]">
            登入失敗，請使用開發帳密 1111 / 1111。
          </p>
        ) : null}

        <button
          type="submit"
          disabled={login.isPending}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] text-[14px] font-black text-white transition hover:bg-[#143964] disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" />
          {login.isPending ? "登入中..." : "登入 /SYSTEM"}
        </button>

        <p className="mt-4 text-center text-[12px] font-bold text-[#8b9aae]">
          預設角色為 /SYSTEM，可切換 /EMPLOYEE 與 /SUPERVISOR。
        </p>
      </form>
    </main>
  );
}
