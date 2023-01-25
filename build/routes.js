"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRoutes = void 0;
const prisma_1 = require("./lib/prisma");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
async function appRoutes(app) {
    app.get('/habits', async (req) => {
        const habits = prisma_1.prisma.habit.findMany();
        return habits;
    });
    app.post('/habits', async (req) => {
        const createhabitBody = zod_1.z.object({
            title: zod_1.z.string(),
            weekDays: zod_1.z.array(zod_1.z.number().min(0).max(6))
        });
        const { title, weekDays } = createhabitBody.parse(req.body);
        const today = (0, dayjs_1.default)().startOf('day').toDate();
        await prisma_1.prisma.habit.create({
            data: {
                title,
                created_at: today,
                weekDays: {
                    create: weekDays.map(weekDays => {
                        return {
                            week_day: weekDays
                        };
                    })
                }
            }
        });
    });
    app.get('/day', async (req) => {
        const getDayParams = zod_1.z.object({
            date: zod_1.z.coerce.date()
        });
        const { date } = getDayParams.parse(req.query);
        const parsedDate = (0, dayjs_1.default)(date).startOf('day');
        const weekDay = parsedDate.get('day');
        const possibleHabits = await prisma_1.prisma.habit.findMany({
            where: {
                created_at: {
                    lte: date,
                },
                weekDays: {
                    some: {
                        week_day: weekDay
                    }
                }
            }
        });
        const day = await prisma_1.prisma.day.findUnique({
            where: {
                date: parsedDate.toDate()
            },
            include: {
                dayHabits: true
            }
        });
        const completedHabits = day?.dayHabits.map(dayHabit => {
            return dayHabit.habit_id;
        });
        return { possibleHabits, completedHabits };
    });
    app.patch('/habits/:id/toggle', async (req) => {
        const toggleHabitParams = zod_1.z.object({
            id: zod_1.z.string().uuid(),
        });
        const { id } = toggleHabitParams.parse(req.params);
        const today = (0, dayjs_1.default)().startOf('day').toDate();
        let day = await prisma_1.prisma.day.findUnique({
            where: {
                date: today,
            }
        });
        if (!day) {
            day = await prisma_1.prisma.day.create({
                data: {
                    date: today,
                }
            });
        }
        const dayHabit = await prisma_1.prisma.dayHabit.findUnique({
            where: {
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id,
                }
            }
        });
        if (dayHabit) {
            await prisma_1.prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id,
                }
            });
        }
        else {
            await prisma_1.prisma.dayHabit.create({
                data: {
                    day_id: day.id,
                    habit_id: id,
                }
            });
        }
    });
    app.get('/summary', async (req) => {
        const summary = await prisma_1.prisma.$queryRaw `
      SELECT 
          D.id,
          D.date,
          (
            SELECT 
              cast(count(*) as float)
            FROM day_habits DH
            WHERE DH.day_id = D.id

          ) as completed,
          (
            SELECT
              cast(count(*) as float)
            FROM habit_week_days HWD
            JOIN habits H
              ON h.id = HWD.habit_id
            WHERE
              HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
              AND H.created_at <= D.date
          ) as amount
      FROM days D

    `;
        return summary;
    });
}
exports.appRoutes = appRoutes;
