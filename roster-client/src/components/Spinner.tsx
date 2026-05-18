export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'h-4 w-4 border-2' : size === 'lg' ? 'h-10 w-10 border-[3px]' : 'h-8 w-8 border-2';
  return (
    <div className="flex items-center justify-center py-20">
      <div className={`animate-spin rounded-full ${sizeClass} border-brand border-t-transparent`} />
    </div>
  );
}
