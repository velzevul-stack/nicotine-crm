'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const { data: debtsData } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api<unknown[]>('/api/debts'),
  });
  const { data: reservesData } = useQuery({
    queryKey: ['reserves'],
    queryFn: () => api<unknown[]>('/api/reserves'),
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
              <div key={i} className="h-32 bg-[#151922] rounded-[20px] animate-pulse" />
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
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-3"
            >
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <motion.button
                    key={section.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.05 }}
                    onClick={() => handleSectionClick(section.id)}
                    className="bg-[#151922] rounded-[20px] p-5 flex flex-col items-start gap-3 active:scale-[0.98] transition-transform relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10"
                      style={{ backgroundColor: section.color }}
                    />
                    <div
                      className="p-3 rounded-[14px] relative z-10"
                      style={{ backgroundColor: `${section.color}20` }}
                    >
                      <Icon size={22} strokeWidth={1.5} style={{ color: section.color }} />
                    </div>
                    <div className="flex-1 relative z-10">
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
                      className="text-[#6B7280] absolute bottom-4 right-4"
                      strokeWidth={1.5}
                    />
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key={`section-${activeSection}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="bg-[#151922] rounded-[20px] overflow-hidden"
            >
              <div
                className="px-5 py-4 border-b"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  background: `linear-gradient(135deg, ${activeData?.color}15 0%, transparent 100%)`,
                }}
              >
                <button
                  onClick={() => setActiveSection(null)}
                  className="flex items-center gap-2 text-[#F5F5F7] active:scale-95 transition-transform"
                >
                  <ArrowLeft size={20} strokeWidth={1.5} />
                  <span className="font-semibold">Назад</span>
                </button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1 }}
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
