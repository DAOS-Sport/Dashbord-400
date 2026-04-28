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
    <main className="grid min-h-dvh bg-[#f4f7fb] text-[#10233f] lg:grid-cols-[1.05fr_0.9fr]">
      <section className="relative flex min-h-[46dvh] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1f456e] via-[#214a70] to-[#0b6c5f] p-8 text-white lg:min-h-dvh lg:p-16">
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-[#9dd84f]/10 blur-3xl" />
        <div>
          <div className="flex items-center gap-3">
            <BrandMark className="h-12 w-12 rounded-[8px]" />
            <div>
              <h1 className="text-[25px] font-black leading-tight">駿斯 CMS</h1>
              <p className="mt-1 text-[12px] font-bold text-white/55">總館營運工作中樞 · v1.0</p>
            </div>
          </div>

          <div className="mt-12 max-w-[360px] lg:mt-20">
            <p className="text-[30px] font-black leading-[1.22] tracking-[-0.01em] lg:text-[34px]">
              每天打開的
              <br />
              那一個入口
            </p>
            <div className="mt-4 h-1 w-16 rounded-full bg-[#9dd84f]" />
            <p className="mt-5 text-[14px] font-medium leading-7 text-white/68">
              登入後請選擇你今天要值班的場館。一個帳號可以綁定多個場館，隨時切換。
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-10 flex flex-wrap gap-2 text-[11px] font-bold text-white/72">
          <span className="rounded-[6px] border border-white/20 bg-white/8 px-3 py-1.5">多館別切換</span>
          <span className="rounded-[6px] border border-white/20 bg-white/8 px-3 py-1.5">SSO 整合</span>
          <span className="rounded-[6px] border border-white/20 bg-white/8 px-3 py-1.5">個人工作入口</span>
        </div>
      </section>

      <section className="grid place-items-center px-5 py-10 lg:px-8">
        <form onSubmit={submit} className="w-full max-w-[390px] rounded-[10px] border border-[#dfe7ef] bg-white p-7 shadow-[0_24px_70px_-42px_rgba(15,34,58,0.5)]">
          <div className="mb-6">
            <h2 className="text-[20px] font-black">員工登入</h2>
            <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">步驟 1 / 2 · 確認個人身分</p>
          </div>

          <label className="block text-[12px] font-black text-[#536175]" htmlFor="username">
            員工編號
          </label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 h-12 w-full rounded-[8px] border border-[#dfe7ef] bg-[#f4f6fa] px-4 text-[14px] font-black outline-none transition focus:border-[#1f6fd1] focus:bg-white"
            autoComplete="username"
          />

          <label className="mt-4 block text-[12px] font-black text-[#536175]" htmlFor="password">
            密碼 / OTP
          </label>
          <input
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-12 w-full rounded-[8px] border border-[#dfe7ef] bg-[#f4f6fa] px-4 text-[14px] font-black tracking-[0.18em] outline-none transition focus:border-[#1f6fd1] focus:bg-white"
            type="password"
            autoComplete="current-password"
          />
          <p className="mt-2 text-[11px] font-bold text-[#8b9aae]">已寄出簡訊 OTP 至 09** ***128 · 54s 後可重發</p>

          {login.error ? (
            <p className="mt-4 rounded-[8px] bg-[#fff0f1] px-3 py-2 text-[12px] font-bold text-[#d43d51]">
              登入失敗，請使用開發帳密 1111 / 1111。
            </p>
          ) : null}

          <button
            type="submit"
            disabled={login.isPending}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] text-[14px] font-black text-white transition hover:bg-[#143964] disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            {login.isPending ? "登入中..." : "下一步：選擇場館 →"}
          </button>

          <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-[#8b9aae]">
            <button type="button" className="hover:text-[#0d2a50]">忘記密碼</button>
            <button type="button" className="hover:text-[#0d2a50]">主管登入</button>
          </div>
        </form>
        <p className="mt-6 text-center text-[11px] font-bold text-[#9aa8ba]">登入即同意內部使用規範 · 所有操作均會留痕</p>
      </section>
    </main>
  );
}
