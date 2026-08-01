import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useCamera } from '../../hooks/useCamera';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface Employee {
  id: string;
  name: string;
  storeId?: string;
  crossStore?: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

type Step = 'select-employee' | 'enter-pin' | 'select-type' | 'camera' | 'confirm' | 'success';

export default function StoreAdminClock() {
  const { success: showSuccess, error: showError } = useToast();
  const { user } = useAuth();
  const { videoRef, fileInputRef, isNative, streamReady, startCamera, stopCamera, capturePhoto, handleFileInputChange } = useCamera();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('select-employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [clockType, setClockType] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captureTime, setCaptureTime] = useState('');
  const [isAnomalous, setIsAnomalous] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    api.get('/users/roster').then((res) => setEmployees(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  // Auto-advance countdown on success
  useEffect(() => {
    if (step !== 'success' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    if (countdown === 1) handleReset();
    return () => clearTimeout(t);
  }, [step, countdown]);

  // Pre-select clock type based on Beijing hour
  const suggestType = useCallback(() => {
    const h = dayjs().tz('Asia/Shanghai').hour();
    if (h >= 5 && h < 23) return 'CLOCK_IN';
    if (h >= 12 && h <= 23) return 'CLOCK_OUT';
    return 'CLOCK_IN';
  }, []);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setPin('');
    setPinError('');
    setStep('enter-pin');
  };

  const handleVerifyPin = async () => {
    if (!selectedEmployee || pin.length < 4) {
      setPinError('请输入4-6位PIN码');
      return;
    }
    setVerifyingPin(true);
    setPinError('');
    try {
      await api.post('/users/verify-pin', { userId: selectedEmployee.id, pin });
      setClockType(suggestType());
      setStep('select-type');
    } catch (err: any) {
      setPinError(err.response?.data?.error || 'PIN码验证失败');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleCapture = async () => {
    const file = await capturePhoto();
    if (!file) {
      showError('拍照失败，请重试');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setCaptureTime(dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'));
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!photoFile || !selectedEmployee) return;
    setSubmitting(true);
    try {
      // Convert photo to base64 for reliable mobile upload (avoids multipart issues through nginx)
      const photoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('读取照片失败'));
        reader.readAsDataURL(photoFile);
      });

      const endpoint = clockType === 'CLOCK_IN' ? '/records/clock-in' : '/records/clock-out';
      const res = await api.post(endpoint, {
        photoBase64,
        photoName: photoFile.name || 'photo.jpg',
        userId: selectedEmployee.id,
      });
      if (res.data.duplicate) {
        showSuccess(`${selectedEmployee.name} 今日已${clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}，无需重复打卡`);
      } else if (res.data.isAnomalous) {
        showSuccess(`${selectedEmployee.name} ${clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}成功（标记为异常打卡）`);
      } else {
        showSuccess(`${selectedEmployee.name} ${clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}成功`);
      }
      setIsAnomalous(res.data.isAnomalous || false);
      setStep('success');
      setCountdown(3);
    } catch (err: any) {
      showError(err.response?.data?.error || '打卡失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep('select-employee');
    setSelectedEmployee(null);
    setPin('');
    setPinError('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setCaptureTime('');
    setIsAnomalous(false);
    setCountdown(0);
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => name.slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator — compact bar */}
      <div className="flex items-center justify-center gap-2 mb-6 text-xs select-none">
        {[
          { key: 'select-employee', label: '选人' },
          { key: 'enter-pin', label: 'PIN' },
          { key: 'select-type', label: '类型' },
          { key: 'camera', label: '拍照' },
          { key: 'confirm', label: '确认' },
        ].map((s, i) => {
          const steps: Step[] = ['select-employee', 'enter-pin', 'select-type', 'camera', 'confirm'];
          const currentIdx = steps.indexOf(step);
          const isDone = i < currentIdx || step === 'success';
          const isCurrent = i === currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300 text-xs">›</span>}
              <span className={`px-2.5 py-1 rounded-full font-medium ${
                isDone ? 'bg-green-100 text-green-700' :
                isCurrent ? 'bg-brand text-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* === STEP 1: Select Employee === */}
      {step === 'select-employee' && (
        <div className="animate-fade-in">
          <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">请选择打卡员工</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleSelectEmployee(emp)}
                className="flex flex-col items-center gap-2 py-5 px-2 bg-surface-card border-2 border-gray-200 rounded-2xl
                           hover:border-brand hover:bg-brand-light active:scale-[0.97]
                           transition-all duration-150 min-h-[88px]"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-brand-light text-brand flex items-center justify-center text-lg font-bold">
                    {getInitials(emp.name)}
                  </div>
                  {emp.storeId && user?.storeId && emp.storeId !== user.storeId && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-accent text-white px-1.5 py-0.5 rounded-full font-semibold">跨店</span>
                  )}
                </div>
                <span className="font-semibold text-gray-800 text-sm leading-tight text-center">
                  {emp.name}
                </span>
                {emp.startTime && emp.endTime ? (
                  <span className="text-xs text-gray-400">{emp.startTime}-{emp.endTime}</span>
                ) : (
                  <span className="text-xs text-gray-300">今日未排班</span>
                )}
              </button>
            ))}
          </div>
          {employees.length === 0 && (
            <p className="text-gray-500 text-center py-12">暂无员工，请先添加员工</p>
          )}
        </div>
      )}

      {/* === STEP 2: Enter PIN === */}
      {step === 'enter-pin' && (
        <div className="animate-fade-in max-w-sm mx-auto">
          <div className="bg-surface-card rounded-2xl border border-gray-200 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-light text-brand flex items-center justify-center text-2xl font-bold mx-auto mb-3">
              {selectedEmployee ? getInitials(selectedEmployee.name) : '?'}
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">{selectedEmployee?.name}</h2>
            <p className="text-gray-500 text-sm mb-5">请输入PIN码验证身份</p>

            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyPin(); }}
              placeholder="····"
              autoFocus
              className="w-full max-w-[200px] mx-auto block px-4 py-4 text-center text-3xl tracking-[0.4em] border-2 border-gray-300 rounded-2xl
                         focus:ring-2 focus:ring-brand focus:border-brand outline-none font-mono"
            />
            {pinError && (
              <p className="text-red-500 text-sm mt-3 animate-fade-in">{pinError}</p>
            )}

            <button
              onClick={handleVerifyPin}
              disabled={verifyingPin || pin.length < 4}
              className="w-full mt-5 bg-brand text-white font-semibold py-3.5 rounded-2xl
                         hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-50 text-base"
            >
              {verifyingPin ? '验证中...' : '确认身份'}
            </button>
          </div>
          <button
            onClick={() => setStep('select-employee')}
            className="block mx-auto mt-3 text-sm text-gray-400 hover:text-gray-600 py-2"
          >
            ← 重新选择员工
          </button>
        </div>
      )}

      {/* === STEP 3: Select Type === */}
      {step === 'select-type' && (
        <div className="animate-fade-in max-w-lg mx-auto">
          <div className="text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-brand-light text-brand flex items-center justify-center text-xl font-bold mx-auto mb-2">
              {selectedEmployee ? getInitials(selectedEmployee.name) : '?'}
            </div>
            <h2 className="text-lg font-bold text-gray-800">{selectedEmployee?.name}</h2>
            <p className="text-gray-500 text-sm">选择打卡类型</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => { setClockType('CLOCK_IN'); setStep('camera'); }}
              className={`py-10 rounded-2xl border-2 text-center transition-all active:scale-[0.97] ${
                clockType === 'CLOCK_IN'
                  ? 'bg-clock-in-light border-clock-in-border ring-2 ring-clock-in/30'
                  : 'bg-surface-card border-gray-200 hover:border-clock-in-border'
              }`}
            >
              <div className="text-4xl mb-2">🏢</div>
              <div className="font-bold text-xl text-clock-in">上班打卡</div>
              <div className="text-xs text-gray-400 mt-1">05:00 — 23:00</div>
            </button>
            <button
              onClick={() => { setClockType('CLOCK_OUT'); setStep('camera'); }}
              className={`py-10 rounded-2xl border-2 text-center transition-all active:scale-[0.97] ${
                clockType === 'CLOCK_OUT'
                  ? 'bg-clock-out-light border-clock-out-border ring-2 ring-clock-out/30'
                  : 'bg-surface-card border-gray-200 hover:border-clock-out-border'
              }`}
            >
              <div className="text-4xl mb-2">🏠</div>
              <div className="font-bold text-xl text-clock-out">下班签退</div>
              <div className="text-xs text-gray-400 mt-1">12:00 — 23:59</div>
            </button>
          </div>

          <button
            onClick={() => setStep('enter-pin')}
            className="block mx-auto mt-4 text-sm text-gray-400 hover:text-gray-600 py-2"
          >
            ← 重新选择
          </button>
        </div>
      )}

      {/* === STEP 4: Camera === */}
      {step === 'camera' && (
        <div className="animate-fade-in max-w-lg mx-auto">
          {/* Hidden file input for mobile capture — must be in DOM for click() to work on mobile browsers */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="text-center mb-3">
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-bold
              {clockType === 'CLOCK_IN' ? 'bg-clock-in-light text-clock-in' : 'bg-clock-out-light text-clock-out'}">
              {clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}
            </span>
          </div>

          {isNative ? (
            /* Native: tap to open system camera */
            <div className="text-center py-8">
              <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-brand-light flex items-center justify-center">
                <svg className="w-16 h-16 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.385 7.74 2 8.35 2 9.02v6.96c0 .67.385 1.28 1.052 1.615.402.2.828.363 1.265.476.48.124.98.194 1.488.194h12.39c.508 0 1.008-.07 1.488-.194.437-.113.863-.275 1.265-.476.667-.335 1.052-.945 1.052-1.615V9.02c0-.67-.385-1.28-1.052-1.615a7.738 7.738 0 00-1.134-.175 2.31 2.31 0 01-1.641-1.055l-.536-.938A2.31 2.31 0 0017 4.01H7a2.31 2.31 0 00-1.997 1.227l-.176.938z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
              <p className="text-gray-600 font-semibold mb-2">点击下方按钮打开相机</p>
              <p className="text-gray-400 text-sm">请确保员工脸部清晰可见</p>
              <button
                onClick={handleCapture}
                className="mt-6 mx-auto w-20 h-20 rounded-full bg-white border-4 border-brand
                           flex items-center justify-center animate-pulse-ring
                           active:scale-90 transition-transform shadow-lg"
                aria-label="拍照"
              >
                <div className="w-14 h-14 rounded-full bg-brand" />
              </button>
            </div>
          ) : streamReady ? (
            /* Browser with video stream */
            <>
              <div className="bg-black rounded-2xl overflow-hidden mb-4 shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-4/3 object-cover"
                />
                <canvas className="hidden" />
              </div>

              <button
                onClick={handleCapture}
                className="block mx-auto w-20 h-20 rounded-full bg-white border-4 border-brand
                           flex items-center justify-center animate-pulse-ring
                           active:scale-90 transition-transform shadow-lg"
                aria-label="拍照"
              >
                <div className="w-14 h-14 rounded-full bg-brand" />
              </button>
              <p className="text-center text-sm text-gray-500 mt-3">点击上方按钮拍照</p>
            </>
          ) : (
            /* Browser no stream (mobile HTTP) — use input capture */
            <div className="text-center py-4">
              <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-brand-light flex items-center justify-center">
                <svg className="w-16 h-16 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.385 7.74 2 8.35 2 9.02v6.96c0 .67.385 1.28 1.052 1.615.402.2.828.363 1.265.476.48.124.98.194 1.488.194h12.39c.508 0 1.008-.07 1.488-.194.437-.113.863-.275 1.265-.476.667-.335 1.052-.945 1.052-1.615V9.02c0-.67-.385-1.28-1.052-1.615a7.738 7.738 0 00-1.134-.175 2.31 2.31 0 01-1.641-1.055l-.536-.938A2.31 2.31 0 0017 4.01H7a2.31 2.31 0 00-1.997 1.227l-.176.938z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
              <p className="text-gray-600 font-semibold mb-2">点击下方按钮拍照</p>
              <p className="text-gray-400 text-sm">请确保员工脸部清晰可见</p>
              <button
                onClick={handleCapture}
                className="mt-6 mx-auto w-20 h-20 rounded-full bg-white border-4 border-brand
                           flex items-center justify-center animate-pulse-ring
                           active:scale-90 transition-transform shadow-lg"
                aria-label="拍照"
              >
                <div className="w-14 h-14 rounded-full bg-brand" />
              </button>
            </div>
          )}

          <button
            onClick={() => setStep('select-type')}
            className="block mx-auto mt-3 text-sm text-gray-400 hover:text-gray-600 py-2"
          >
            ← 返回
          </button>
        </div>
      )}

      {/* === STEP 5: Confirm === */}
      {step === 'confirm' && (
        <div className="animate-fade-in max-w-sm mx-auto">
          <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">确认打卡信息</h2>

          <div className="bg-surface-card rounded-2xl border border-gray-200 overflow-hidden">
            {/* Photo */}
            {photoPreview && (
              <div className="aspect-4/3 bg-black">
                <img src={photoPreview} alt="打卡照片" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* Employee */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold text-sm">
                  {selectedEmployee ? getInitials(selectedEmployee.name) : '?'}
                </div>
                <div>
                  <div className="font-bold text-gray-800">{selectedEmployee?.name}</div>
                  <div className={`text-sm font-semibold ${
                    clockType === 'CLOCK_IN' ? 'text-clock-in' : 'text-clock-out'
                  }`}>
                    {clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}
                  </div>
                </div>
              </div>

              {/* Time */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                <div className="text-xs text-gray-500 mb-0.5">打卡时间</div>
                <div className="font-mono font-bold text-gray-800">{captureTime}</div>
                <div className="text-xs text-gray-400">北京时间</div>
              </div>

              {/* Anomaly warning */}
              {(() => {
                const hour = dayjs().tz('Asia/Shanghai').hour();
                const isOutOfWindow = clockType === 'CLOCK_IN' ? (hour < 5 || hour > 23) : (hour < 12 || hour > 23);
                if (isOutOfWindow) {
                  return (
                    <div className="bg-anomaly-light border border-anomaly-border rounded-xl p-3 text-center animate-fade-in">
                      <div className="text-anomaly text-sm font-bold">⚠️ 异常打卡</div>
                      <div className="text-anomaly/70 text-xs mt-0.5">
                        不在{clockType === 'CLOCK_IN' ? '上班（05:00-23:00）' : '下班（12:00-23:59）'}窗口内
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { setStep('camera'); setPhotoFile(null); setPhotoPreview(null); }}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold
                         hover:bg-gray-200 active:scale-[0.98] transition-all text-base"
            >
              重拍
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3.5 bg-brand text-white rounded-2xl font-bold
                         hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-50 text-base"
            >
              {submitting ? '提交中...' : '确认打卡'}
            </button>
          </div>
        </div>
      )}

      {/* === STEP 6: Success === */}
      {step === 'success' && (
        <div className="animate-fade-in text-center max-w-sm mx-auto">
          <div className="bg-surface-card rounded-2xl border border-gray-200 p-8">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">打卡成功</h2>
            <p className="text-gray-500 mb-2">
              {selectedEmployee?.name} {clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}已记录
            </p>
            {isAnomalous && (
              <span className="inline-block bg-anomaly-light text-anomaly text-xs font-semibold px-3 py-1 rounded-full">
                异常打卡
              </span>
            )}
            <p className="text-gray-400 text-sm mt-4">
              {countdown > 0 ? `${countdown}秒后自动返回...` : ' '}
            </p>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleReset}
              className="flex-1 py-3.5 bg-brand text-white rounded-2xl font-bold
                         hover:bg-brand-dark active:scale-[0.98] transition-all text-base"
            >
              继续打卡
            </button>
            <button
              onClick={() => navigate('/store-admin')}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold
                         hover:bg-gray-200 active:scale-[0.98] transition-all text-base"
            >
              返回首页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
