'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ShoppingCart, FileText, Rocket, X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

const ONBOARDING_KEY = 'onboarding_completed';

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}

const steps: Step[] = [
  {
    icon: Sparkles,
    title: 'Добро пожаловать!',
    description: 'Post Stock Pro — ваш помощник в управлении товарами, продажами и контентом. Давайте познакомимся с основными функциями.',
    color: '#BFE7E5',
  },
  {
    icon: Package,
    title: 'Управляйте складом',
    description: 'Добавляйте категории, бренды и товары. Отслеживайте остатки в реальном времени и получайте уведомления.',
    color: '#CFE6F2',
  },
  {
    icon: ShoppingCart,
    title: 'Оформляйте продажи',
    description: 'Быстрое оформление продаж с поддержкой наличных, карты, сплит-оплаты и долгов. Автоматическое списание со склада.',
    color: '#DED8F6',
  },
  {
    icon: FileText,
    title: 'Генерируйте посты',
    description: 'Создавайте красивые посты для социальных сетей с актуальными остатками и ценами одним нажатием.',
    color: '#F2D6DE',
  },
  {
    icon: Rocket,
    title: 'Всё готово!',
    description: 'Начните с добавления товаров на склад. У вас есть пробный период для знакомства со всеми возможностями.',
    color: '#BFE7E5',
  },
];

export function OnboardingGuide() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!visible) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-sm bg-[#151922] rounded-[24px] border border-white/[0.08] overflow-hidden"
          >
            {/* Header with skip */}
            <div className="flex items-center justify-between px-5 pt-4">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: i === currentStep ? 20 : 8,
                      backgroundColor: i === currentStep ? step.color : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>
              <button
                onClick={handleSkip}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9CA3AF] transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-8 flex flex-col items-center text-center">
              <motion.div
                key={`icon-${currentStep}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="w-16 h-16 rounded-[18px] flex items-center justify-center mb-5"
                style={{ backgroundColor: `${step.color}18` }}
              >
                <Icon size={28} strokeWidth={1.5} style={{ color: step.color }} />
              </motion.div>
              <h2 className="text-xl font-bold text-[#F5F5F7] mb-3">{step.title}</h2>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">{step.description}</p>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex items-center justify-center w-10 h-10 rounded-[12px] border border-white/10 text-[#9CA3AF] hover:bg-white/[0.04] transition-colors"
                >
                  <ChevronLeft size={18} strokeWidth={1.5} />
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 py-3 rounded-[12px] font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: step.color, color: '#111111' }}
              >
                {isLast ? 'Начать работу' : 'Далее'}
                {!isLast && <ChevronRight size={16} strokeWidth={2} />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
