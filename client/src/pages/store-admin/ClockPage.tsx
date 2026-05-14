import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
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
}

type Step = 'select-employee' | 'enter-pin' | 'select-type' | 'camera' | 'confirm' | 'success';

export default function StoreAdminClock() {
  const { success: showSuccess, error: showError } = useToast();
  const { videoRef, startCamera, stopCamera, capturePhoto } = useCamera();
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
      const form = new FormData();
      form.append('photo', photoFile);
      form.append('userId', selectedEmployee.id);
      const endpoint = clockType === 'CLOCK_IN' ? '/records/clock-in' : '/records/clock-out';
      const res = await api.post(endpoint, form);
      if (res.data.duplicate) {
        showSuccess(`${selectedEmployee.name} 今日已${clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}，无需重复打卡`);
      } else if (res.data.isAnomalous) {
        showSuccess(`${selectedEmployee.name} ${clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}成功（标记为异常打卡）`);
      } else {
        showSuccess(`${selectedEmployee.name} ${clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}成功`);
      }
      setIsAnomalous(res.data.isAnomalous || false);
      setStep('success');
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
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">员工打卡</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        {['select-employee', 'enter-pin', 'select-type', 'camera', 'confirm'].map((s, i) => {
          const labels = ['选择员工', 'PIN验证', '上班/下班', '拍照', '确认'];
          const currentIdx = ['select-employee', 'enter-pin', 'select-type', 'camera', 'confirm'].indexOf(step);
          const isDone = i < currentIdx || step === 'success';
          const isCurrent = i === currentIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">→</span>}
              <span className={`px-2 py-1 rounded text-xs ${
                isDone ? 'bg-green-100 text-green-700' :
                isCurrent ? 'bg-brand text-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step: Select employee */}
      {step === 'select-employee' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">请选择打卡员工</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleSelectEmployee(emp)}
                className="px-4 py-6 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-brand hover:bg-brand-light transition-colors text-center"
              >
                <div className="text-2xl mb-2">👤</div>
                <div className="font-medium text-gray-800">{emp.name}</div>
              </button>
            ))}
          </div>
          {employees.length === 0 && (
            <p className="text-gray-500 text-center py-8">暂无员工，请先添加员工</p>
          )}
        </div>
      )}

      {/* Step: Enter PIN */}
      {step === 'enter-pin' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {selectedEmployee?.name} — 请输入PIN码
          </h2>
          <div className="max-w-xs mx-auto space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyPin(); }}
                placeholder="4-6位数字PIN码"
                autoFocus
                className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none"
              />
              {pinError && <p className="text-red-500 text-sm mt-2 text-center">{pinError}</p>}
            </div>
            <button
              onClick={handleVerifyPin}
              disabled={verifyingPin || pin.length < 4}
              className="w-full bg-brand text-white py-3 rounded-lg hover:bg-brand-dark disabled:opacity-50 font-medium"
            >
              {verifyingPin ? '验证中...' : '确认'}
            </button>
            <button
              onClick={() => setStep('select-employee')}
              className="w-full text-sm text-gray-400 hover:text-gray-600"
            >
              ← 重新选择员工
            </button>
          </div>
        </div>
      )}

      {/* Step: Select type */}
      {step === 'select-type' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {selectedEmployee?.name} — 选择打卡类型
          </h2>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <button
              onClick={() => { setClockType('CLOCK_IN'); setStep('camera'); }}
              className="px-4 py-8 bg-green-50 border-2 border-green-300 rounded-xl hover:bg-green-100 transition-colors text-center"
            >
              <div className="text-3xl mb-2">🏢</div>
              <div className="font-semibold text-green-700">上班打卡</div>
            </button>
            <button
              onClick={() => { setClockType('CLOCK_OUT'); setStep('camera'); }}
              className="px-4 py-8 bg-orange-50 border-2 border-orange-300 rounded-xl hover:bg-orange-100 transition-colors text-center"
            >
              <div className="text-3xl mb-2">🏠</div>
              <div className="font-semibold text-orange-700">下班签退</div>
            </button>
          </div>
          <button
            onClick={() => setStep('enter-pin')}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600"
          >
            ← 重新选择
          </button>
        </div>
      )}

      {/* Step: Camera */}
      {step === 'camera' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {selectedEmployee?.name} — {clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'} — 拍照
          </h2>
          <div className="max-w-md mx-auto">
            <div className="bg-black rounded-lg overflow-hidden mb-4">
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
              className="w-full bg-brand text-white py-3 rounded-lg hover:bg-brand-dark transition-colors font-medium"
            >
              📷 拍照
            </button>
            <button
              onClick={() => setStep('select-type')}
              className="mt-2 text-sm text-gray-400 hover:text-gray-600"
            >
              ← 重新选择
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">确认打卡信息</h2>
          <div className="max-w-sm mx-auto space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-sm text-gray-500">员工</div>
              <div className="font-bold text-gray-800 text-lg">{selectedEmployee?.name}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-sm text-gray-500">类型</div>
              <div className={`font-bold text-lg ${clockType === 'CLOCK_IN' ? 'text-green-600' : 'text-orange-600'}`}>
                {clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-sm text-gray-500">时间</div>
              <div className="font-bold text-gray-800 font-mono">{captureTime} 北京</div>
            </div>
            {/* Anomaly warning */}
            {(() => {
              const hour = dayjs().tz('Asia/Shanghai').hour();
              const isOutOfWindow = clockType === 'CLOCK_IN' ? (hour < 5 || hour >= 12) : (hour < 12 || hour > 23);
              if (isOutOfWindow) {
                return (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-center">
                    <div className="text-yellow-700 text-sm font-medium">⚠️ 异常打卡</div>
                    <div className="text-yellow-600 text-xs mt-1">
                      当前时间不在{clockType === 'CLOCK_IN' ? '上班（05:00-12:00）' : '下班（12:00-23:59）'}打卡窗口内，将标记为异常打卡
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {photoPreview && (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                <img src={photoPreview} alt="打卡照片" className="w-full" />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('camera'); setPhotoFile(null); setPhotoPreview(null); }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                重拍
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 font-medium"
              >
                {submitting ? '提交中...' : '确认打卡'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Success */}
      {step === 'success' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">打卡成功</h2>
          <p className="text-gray-500 mb-6">
            {selectedEmployee?.name} {clockType === 'CLOCK_IN' ? '上班打卡' : '下班签退'}已记录
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark font-medium"
            >
              继续打卡
            </button>
            <button
              onClick={() => navigate('/store-admin')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              返回首页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
