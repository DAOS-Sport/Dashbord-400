import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAllActiveFacilities } from "@/config/facility-configs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden>{name}</span>;
}

export default function PortalLogin() {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedFacility, setSelectedFacility] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const facilities = getAllActiveFacilities();

  const loginMut = useMutation({
    mutationFn: async () => {
      const loginRes = await apiRequest("POST", "/api/auth/login", {
        username: employeeNumber.trim(),
        password: phone.trim(),
      });
      const session = await loginRes.json();
      if (selectedFacility) {
        await apiRequest("POST", "/api/auth/active-facility", { activeFacility: selectedFacility });
      }
      return session;
    },
    onSuccess: () => {
      navigate(selectedFacility ? `/portal/${selectedFacility}` : "/portal");
    },
    onError: (err: Error) => {
      toast({ title: "登入失敗", description: err.message || "員工編號或手機號碼不正確", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeNumber.trim() || !phone.trim()) {
      toast({ title: "請填寫完整", description: "員工編號和手機號碼為必填", variant: "destructive" });
      return;
    }
    loginMut.mutate();
  };

  return (
    <div className="portal min-h-screen bg-stitch-surface flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #006b60, transparent)" }}
        aria-hidden
      />
      <div
        className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #9dd84f, transparent)" }}
        aria-hidden
      />

      <div className="w-full max-w-md relative" data-testid="section-portal-login">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-teal-glow"
            style={{ background: "linear-gradient(135deg, #006b60, #9dd84f)" }}
          >
            <MaterialIcon name="bolt" className="text-white text-3xl" />
          </div>
          <p className="portal-label text-stitch-secondary mb-2">JUNSI CMS PORTAL</p>
          <h1
            className="font-headline text-3xl md:text-4xl font-black text-stitch-primary tracking-tight"
            data-testid="text-portal-login-title"
          >
            員工值班入口
          </h1>
          <p className="text-slate-500 text-sm mt-2">駿斯運動事業 — 員工專屬系統</p>
        </div>

        <form onSubmit={handleSubmit} className="portal-bento p-7 space-y-5" data-testid="form-portal-login">
          <div>
            <label className="portal-label text-stitch-secondary block mb-2">員工編號</label>
            <div className="relative">
              <MaterialIcon name="badge" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" />
              <input
                type="text"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="請輸入員工編號"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-stitch-on-surface placeholder:text-slate-400 bg-stitch-surface-low focus:outline-none focus:ring-2 focus:ring-stitch-secondary"
                data-testid="input-employee-number"
              />
            </div>
          </div>

          <div>
            <label className="portal-label text-stitch-secondary block mb-2">手機號碼（密碼）</label>
            <div className="relative">
              <MaterialIcon name="phone_iphone" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" />
              <input
                type="password"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="請輸入手機號碼"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-stitch-on-surface placeholder:text-slate-400 bg-stitch-surface-low focus:outline-none focus:ring-2 focus:ring-stitch-secondary"
                data-testid="input-phone"
              />
            </div>
          </div>

          <div>
            <label className="portal-label text-stitch-secondary block mb-2">選擇場館</label>
            <div className="relative">
              <MaterialIcon name="apartment" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none" />
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-stitch-on-surface bg-stitch-surface-low focus:outline-none focus:ring-2 focus:ring-stitch-secondary appearance-none"
                data-testid="select-facility"
              >
                <option value="">請選擇場館...</option>
                {facilities.map((f) => (
                  <option key={f.facilityKey} value={f.facilityKey}>
                    {f.facilityName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginMut.isPending}
            className="portal-pill-cta w-full justify-center py-3 disabled:opacity-50"
            data-testid="button-login"
          >
            <MaterialIcon
              name={loginMut.isPending ? "hourglass_empty" : "login"}
              className={`text-[18px] ${loginMut.isPending ? "animate-spin" : ""}`}
            />
            {loginMut.isPending ? "驗證中..." : "登入"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">如有登入問題，請聯繫您的場館主管</p>
      </div>
    </div>
  );
}
