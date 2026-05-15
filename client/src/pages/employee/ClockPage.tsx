import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useCamera } from '../../hooks/useCamera';
import api from '../../api/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

type ClockStep = 'identity' | 'select' | 'camera' | 'confirm' | 'success';

interface EmployeeItem {
  id: string;
  name: string;
  email: string;
}

export default function ClockPage() {
  const { user } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const { videoRef, fileInputRef, error: cameraError, startCamera, stopCamera, capturePhoto, handleFileInputChange } = useCamera();
  const [step, setStep] = useState<ClockStep>('identity');
  const [clockType, setClockType] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [capturedTime, setCapturedTime] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  useEffect(() => {
    api.get('/users/roster')
      .then((res) => setEmployees(res.data))
      .catch(() => {})
      .finally(() => setLoadingEmployees(false));
    return () => stopCamera();
  }, [stopCamera]);

  const handleSelectIdentity = (emp: EmployeeItem) => {
    setSelectedEmployee(emp);
    setStep('select');
  };

  const handleSelect = async (type: 'CLOCK_IN' | 'CLOCK_OUT') => {
    setClockType(type);
    setStep('camera');
    await startCamera();
  };

  const handleCapture = async () => {
    const file = await capturePhoto();
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setCapturedTime(dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'));
      stopCamera();
      setStep('confirm');
    }
  };

  const handleSubmit = async () => {
    if (!photo || !selectedEmployee) return;
    setSubmitting(true);
    try {
      const photoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('读取照片失败'));
        reader.readAsDataURL(photo);
      });
      const endpoint = clockType === 'CLOCK_IN' ? '/records/clock-in' : '/records/clock-out';
      const res = await api.post(endpoint, {
        photoBase64,
        photoName: photo.name || 'photo.jpg',
        userId: selectedEmployee.id,
      });
      setResult(res.data);
      setStep('success');
      showSuccess(`${clockType === 'CLOCK_IN' ? '上班' : '下班'}打卡成功`);
    } catch (err: any) {
      showError(err.response?.data?.error || '打卡失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setPhoto(null);
    setPhotoPreview('');
    setCapturedTime('');
    setResult(null);
    setSelectedEmployee(null);
    setStep('identity');
  };

  // Step: identity confirmation
  if (step === 'identity') {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-2 text-center">确认身份</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          请从名单中选择您的姓名以确认身份
        </p>

        {loadingEmployees ? (
          <div className="text-center text-gray-500 py-8">加载名单中...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleSelectIdentity(emp)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  emp.id === user?.id
                    ? 'border-brand bg-brand-light hover:bg-blue-100'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="font-medium text-gray-800 text-sm">{emp.name}</div>
                {emp.id === user?.id && (
                  <div className="text-xs text-brand mt-1">当前账号</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (step === 'success' && result) {
    return (
      <div className="text-center py-10">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          {clockType === 'CLOCK_IN' ? '上班打卡' : '下班打卡'}成功
        </h1>
        <p className="text-gray-500">
          {selectedEmployee?.name} — {result.createdAt}
        </p>
        <div className="mt-6 space-x-3">
          <button
            onClick={handleReset}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-dark transition-colors"
          >
            继续打卡
          </button>
        </div>
      </div>
    );
  }

  if (step === 'camera') {
    return (
      <div className="max-w-lg mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <h1 className="text-xl font-bold text-gray-800 mb-4 text-center">
          {selectedEmployee?.name} — {clockType === 'CLOCK_IN' ? '上班打卡' : '下班打卡'} - 拍照
        </h1>
        <p className="text-sm text-gray-500 mb-4 text-center">
          请正对摄像头，点击拍照按钮
        </p>

        {cameraError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{cameraError}</div>
        )}

        <div className="bg-black rounded-xl overflow-hidden mb-4 aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => { stopCamera(); setStep('select'); }}
            className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-300 transition-colors"
          >
            返回
          </button>
          <button
            onClick={handleCapture}
            className="bg-brand text-white px-8 py-2.5 rounded-lg hover:bg-brand-dark transition-colors font-medium"
          >
            📷 拍照
          </button>
        </div>
      </div>
    );
  }

  if (step === 'confirm' && photoPreview) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-4">
          确认{clockType === 'CLOCK_IN' ? '上班' : '下班'}打卡
        </h1>

        <img src={photoPreview} alt="打卡照片" className="w-full rounded-xl mb-4 shadow-sm" />

        <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-600">
          <p>打卡人：<strong>{selectedEmployee?.name}</strong></p>
          <p>类型：<strong>{clockType === 'CLOCK_IN' ? '上班' : '下班'}</strong></p>
          <p className="mt-2 text-lg font-bold text-gray-800">
            打卡时间：{capturedTime}
          </p>
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => { setStep('camera'); startCamera(); }}
            className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-300 transition-colors"
          >
            重新拍照
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-brand text-white px-8 py-2.5 rounded-lg hover:bg-brand-dark transition-colors font-medium disabled:opacity-50"
          >
            {submitting ? '提交中...' : '确认打卡'}
          </button>
        </div>
      </div>
    );
  }

  // Step: select clock type
  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-2 text-center">选择打卡类型</h1>
      <p className="text-sm text-gray-500 mb-6 text-center">
        打卡人：<strong>{selectedEmployee?.name}</strong>
      </p>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleSelect('CLOCK_IN')}
          className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-8 hover:border-green-400 hover:shadow-md transition-all text-center"
        >
          <div className="text-4xl mb-3">🌅</div>
          <div className="text-lg font-semibold text-gray-800">上班打卡</div>
          <div className="text-sm text-gray-500 mt-1">确认身份并拍照</div>
        </button>

        <button
          onClick={() => handleSelect('CLOCK_OUT')}
          className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-8 hover:border-orange-400 hover:shadow-md transition-all text-center"
        >
          <div className="text-4xl mb-3">🌆</div>
          <div className="text-lg font-semibold text-gray-800">下班打卡</div>
          <div className="text-sm text-gray-500 mt-1">确认身份并拍照</div>
        </button>
      </div>
    </div>
  );
}
