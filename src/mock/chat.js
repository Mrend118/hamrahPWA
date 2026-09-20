const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

export const mockMessages = [
  {
    id: 1,
    from: "consultant",
    text: "سلام علی 👋 خوش اومدی! هر سوالی درباره برنامه مطالعاتی داشتی همینجا بپرس.",
    createdAt: minutesAgo(180),
  },
  {
    id: 2,
    from: "me",
    text: "سلام. برای فیزیک فصل دوم از کدوم منبع تست بزنم؟",
    createdAt: minutesAgo(174),
  },
  {
    id: 3,
    from: "consultant",
    text: "اول تست‌های آخر فصل کتاب درسی، بعد سطح متوسط آزمون‌های جامع. شب امتحان سراغ سوالات سخت نرو.",
    createdAt: minutesAgo(170),
  },
  {
    id: 4,
    from: "me",
    text: "ممنون. هفته آینده برنامه رو سنگین‌تر کنم؟",
    createdAt: minutesAgo(30),
  },
];
