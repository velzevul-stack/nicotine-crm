'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Store, CreditCard, Package, Crown, Users, ChevronRight, ArrowLeft, Wallet, BarChart3, Truck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ScreenHeader } from '@/components/ScreenHeader';
import { api } from '@/lib/api-client';
import { ReferralsTab } from './profile/ReferralsTab';
import { SubscriptionTab } from './profile/SubscriptionTab';
import { ReservesTab } from './profile/ReservesTab';
import { SettingsTab } from './profile/SettingsTab';
import { DebtsTab } from './profile/DebtsTab';
import { CardsTab } from './profile/CardsTab';
import { ReportsCardTab } from './profile/ReportsCardTab';
import { DeliveryTab } from './profile/DeliveryTab';

type Section = 'settings' | 'debts' | 'reserves' | 'cards' | 'reports' | 'delivery' | 'subscription' | 'referrals';

export function Profile() {
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const reduceMotion = useReducedMotion();

  // После mount: сначала отрисовка сетки, потом запросы — меньше конкуренции с анимацией на слабых телефонах
  const { data: debtsData } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api<unknown[]>('/api/debts'),
    enabled: mounted,
    staleTime: 60_000,
  });
  const { data: reservesData } = useQuery({
    queryKey: ['reserves'],
    queryFn: () => api<unknown[]>('/api/reserves'),
    enabled: mounted,
    staleTime: 60_000,
  });

  const debtsCount = Array.isArray(debtsData) ? debtsData.length : 0;
  const reservesCount = Array.isArray(reservesData) ? reservesData.length : 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const sections = [
    { id: 'settings' as Section, label: 'Настройки магазина', icon: Store, badge: undefined, color: '#BFE7E5' },
    { id: 'debts' as Section, label: 'Долги', icon: CreditCard, badge: debtsCount, color: '#CFE6F2' },
    { id: 'reserves' as Section, label: 'Резервы', icon: Package, badge: reservesCount, color: '#DED8F6' },
    { id: 'cards' as Section, label: 'Карты', icon: Wallet, badge: undefined, color: '#9FD4D1' },
    { id: 'reports' as Section, label: 'Отчёты', icon: BarChart3, badge: undefined, color: '#BFE7E5' },
    { id: 'delivery' as Section, label: 'Поставка', icon: Truck, badge: undefined, color: '#DED8F6' },
    { id: 'subscription' as Section, label: 'Подписка', icon: Crown, badge: undefined, color: '#F2D6DE' },
    { id: 'referrals' as Section, label: 'Рефералы', icon: Users, badge: undefined, color: '#CFE6F2' },
  ];

  const handleSectionClick = (section: Section) => {
    setActiveSection(section);
  };

  const activeData = sections.find((s) => s.id === activeSection);

  if (!mounted) {
    return (
      <>
        <ScreenHeader title="Профиль" subtitle="Настройки и управление" />
        <div className="px-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-32 bg-[#151922] rounded-[20px]" />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="Профиль" subtitle="Настройки и управление" />

      <section className="px-5 pb-6">
        <AnimatePresence mode="wait">
          {!activeSection ? (
            <motion.div
              key="grid"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              className="grid grid-cols-2 gap-3"
            >
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <motion.button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionClick(section.id)}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            delay: index * 0.03,
                            duration: 0.28,
                            ease: [0.25, 0.1, 0.25, 1],
                          }
                    }
                    whileHover={
                      reduceMotion
                        ? undefined
                        : { y: -2, transition: { duration: 0.2, ease: 'easeOut' } }
                    }
                    whileTap={
                      reduceMotion
                        ? undefined
                        : { scale: 0.98, transition: { duration: 0.12, ease: 'easeOut' } }
                    }
                    className="relative bg-[#151922] rounded-[20px] p-5 flex flex-col items-start gap-3 text-left border border-white/[0.06] shadow-sm hover:border-white/[0.1] hover:shadow-md transition-[border-color,box-shadow] duration-200"
                  >
                    <div
                      className="p-3 rounded-[14px]"
                      style={{ backgroundColor: `${section.color}18` }}
                    >
                      <Icon size={22} strokeWidth={1.5} style={{ color: section.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[#F5F5F7] font-semibold text-sm text-left">
                        {section.label}
                      </h3>
                      {section.badge !== undefined && section.badge > 0 && (
                        <span
                          className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: `${section.color}20`,
                            color: section.color,
                          }}
                        >
                          {section.badge}
                        </span>
                      )}
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-[#6B7280] absolute bottom-4 right-4 shrink-0"
                      strokeWidth={1.5}
                    />
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key={`section-${activeSection}`}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.25, 0.1, 0.25, 1] }}
              className="bg-[#151922] rounded-[20px] overflow-hidden border border-white/[0.06]"
            >
              <div
                className="px-5 py-4 border-b"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  background: `linear-gradient(135deg, ${activeData?.color}15 0%, transparent 100%)`,
                }}
              >
                <motion.button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="flex items-center gap-2 text-[#F5F5F7] rounded-lg -m-1 p-1 hover:bg-white/[0.04] transition-colors"
                >
                  <ArrowLeft size={20} strokeWidth={1.5} />
                  <span className="font-semibold">Назад</span>
                </button>
              </div>

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                className="p-5"
              >
                {activeSection === 'settings' && <SettingsTab />}
                {activeSection === 'debts' && <DebtsTab />}
                {activeSection === 'reserves' && <ReservesTab />}
                {activeSection === 'cards' && <CardsTab />}
                {activeSection === 'reports' && <ReportsCardTab />}
                {activeSection === 'delivery' && <DeliveryTab />}
                {activeSection === 'subscription' && (
                  <div className="space-y-4">
                    <SubscriptionTab />
                    <ReferralsTab />
                  </div>
                )}
                {activeSection === 'referrals' && <ReferralsTab />}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </>
  );
}
