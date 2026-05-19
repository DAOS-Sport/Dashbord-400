import { FormEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { KeyRound, MapPin } from "lucide-react";
import { roleHomePath, type AuthMeDto, type FacilityCandidatesResponseDto } from "@shared/auth/me";
import { apiGet } from "@/shared/api/client";
import { useAuthMe, useLogin, useSwitchFacility } from "@/shared/auth/session";
import { BrandMark } from "@/shared/brand";

export default function WorkbenchLoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authenticatedSession, setAuthenticatedSession] = useState<AuthMeDto | null>(null);
  const [step, setStep] = useState<"identity" | "facility">("identity");
  const sessionQuery = useAuthMe();
  const login = useLogin();
  const switchFacility = useSwitchFacility();
  const facilityCandidates = useQuery({
    queryKey: ["/api/auth/facility-candidates", authenticatedSession?.userId],
    queryFn: () => apiGet<FacilityCandidatesResponseDto>("/api/auth/facility-candidates"),
    enabled: step === "facility",
    retry: false,
  });

  useEffect(() => {
    if (sessionQuery.data) {
      setAuthenticatedSession(sessionQuery.data);
      setStep("facility");
    }
  }, [sessionQuery.data]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate(
      { username, password },
      {
        onSuccess: (session) => {
          setAuthenticatedSession(session);
          setStep("facility");
        },
      },
    );
  };

  const enterWorkbench = (facilityKey: string) => {
    switchFacility.mutate(facilityKey, {
      onSuccess: (session) => setLocation(roleHomePath[session.activeRole]),
    });
  };

  return (
    <main className="min-h-dvh bg-[#eef3f7] text-[#10233f]">
      <div className="grid min-h-dvh lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[#17365c] p-12 text-white lg:flex lg:flex-col">
          <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
          <div>
            <div className="flex items-center gap-3">
              <BrandMark className="h-12 w-12 rounded-[8px]" />
              <h1 className="text-[25px] font-black leading-tight">駿斯 CMS</h1>
            </div>
            <div className="mt-20 max-w-[430px]">
              <p className="text-[34px] font-black leading-[1.18]">場館營運工作台</p>
              <div className="mt-5 h-1 w-20 rounded-full bg-[#9dd84f]" />
            </div>
          </div>
        </section>

        <section className="grid place-items-center px-5 py-8">
          {step === "identity" ? (
            <form onSubmit={submit} className="w-full max-w-[420px] rounded-[12px] border border-[#d7e1ea] bg-white p-7 shadow-[0_24px_80px_-48px_rgba(15,34,58,0.62)]">
              <div className="mb-7 flex items-center gap-3 lg:hidden">
                <BrandMark className="h-11 w-11 rounded-[8px]" />
                <h1 className="text-[22px] font-black">駿斯 CMS</h1>
              </div>
              <div className="mb-6">
                <h2 className="text-[24px] font-black">工作台登入</h2>
              </div>

              <label className="block text-[12px] font-black text-[#536175]" htmlFor="username">
                員工編號
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 h-12 w-full rounded-[8px] border border-[#cfd9e5] bg-white px-4 text-[15px] font-bold outline-none transition focus:border-[#1f6fd1] focus:ring-4 focus:ring-[#1f6fd1]/10"
                autoComplete="username"
              />

              <label className="mt-4 block text-[12px] font-black text-[#536175]" htmlFor="password">
                密碼
              </label>
              <input
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-[8px] border border-[#cfd9e5] bg-white px-4 text-[15px] font-bold outline-none transition focus:border-[#1f6fd1] focus:ring-4 focus:ring-[#1f6fd1]/10"
                type="password"
                autoComplete="current-password"
              />

              {login.error ? (
                <p className="mt-4 rounded-[8px] bg-[#fff0f1] px-3 py-2 text-[12px] font-bold text-[#d43d51]">
                  登入失敗，請確認帳號或密碼。
                </p>
              ) : null}

              <button
                type="submit"
                disabled={!username.trim() || !password.trim() || login.isPending}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#10233f] text-[14px] font-black text-white transition hover:bg-[#17365c] active:translate-y-px disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {login.isPending ? "登入中..." : "登入並選擇場館"}
              </button>
            </form>
          ) : (
            <section className="w-full max-w-[760px] rounded-[12px] border border-[#d7e1ea] bg-white p-7 shadow-[0_24px_80px_-48px_rgba(15,34,58,0.62)]">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[26px] font-black text-[#10233f]">選擇今日工作場館</h2>
                </div>
              </div>
              {facilityCandidates.isLoading ? (
                <div className="rounded-[8px] bg-[#f7f9fb] p-6 text-[13px] font-bold text-[#637185]">讀取館別中...</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {(facilityCandidates.data?.items ?? []).map((candidate) => (
                    <button
                      key={candidate.facilityKey}
                      type="button"
                      onClick={() => enterWorkbench(candidate.facilityKey)}
                      disabled={switchFacility.isPending}
                      className="workbench-focus group min-h-[118px] rounded-[10px] border border-[#dfe7ef] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#1cb4a3] hover:shadow-[0_22px_56px_-40px_rgba(15,34,58,0.58)] disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[18px] font-black text-[#10233f]">{candidate.displayName}</h3>
                          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">{candidate.regionGroup} · {candidate.operationType}</p>
                        </div>
                        <span className="rounded-full bg-[#dff5d7] px-3 py-1 text-[11px] font-black text-[#12854d]">{candidate.statusLabel}</span>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-[#edf2f7] pt-3">
                        <span className="inline-flex min-w-0 items-center gap-1 text-[12px] font-bold text-[#637185]">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span className="truncate">{candidate.departmentName}</span>
                        </span>
                        <span className="rounded-[8px] bg-[#10233f] px-3 py-2 text-[12px] font-black text-white group-hover:bg-[#17365c]">進入</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!facilityCandidates.isLoading && !facilityCandidates.data?.items.length ? (
                <div className="rounded-[8px] bg-[#fff0f1] p-4 text-[13px] font-bold text-[#d43d51]">目前沒有可選館別，請確認員工授權。</div>
              ) : null}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
