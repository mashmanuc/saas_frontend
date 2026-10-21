import apiClient from '@/utils/apiClient'

// ⚠️ ЗГЕНЕРОВАНО з backend/apps/lesson_constructor/domain/topic_taxonomy.py
//    Не редагувати руками: `python manage.py export_topics --write`.
//    SSOT: saas_docs/domains/LESSON_CONSTRUCTOR/TOPIC_TAXONOMY_DECISION.md
export const TOPICS = [
  { value: 'real-numbers',                                                            label: 'Дійсні числа', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.natural',                                                    label: 'Натуральні числа', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.divisibility',                                               label: 'Подільність', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions',                                                  label: 'Дроби', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.ordinary',                                         label: 'Звичайні дроби', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.ordinary.add-subtract',                            label: 'Додавання і віднімання дробів з різними знаменниками', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.ordinary.multiply-divide',                         label: 'Множення і ділення звичайних дробів', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.decimal',                                          label: 'Десяткові дроби', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.decimal.add-subtract',                             label: 'Додавання і віднімання десяткових дробів', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.decimal.multiply-divide',                          label: 'Множення і ділення десяткових дробів', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.decimal.order-of-operations',                      label: 'Порядок дій із десятковими дробами', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.rational',                                                   label: 'Раціональні числа', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.rational.add-subtract',                                      label: 'Додавання і віднімання раціональних чисел', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.rational.multiply-divide',                                   label: 'Множення і ділення раціональних чисел', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.rational.order-of-operations',                               label: 'Усі дії з раціональними числами', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems',                                           label: 'Відношення, відсотки, задачі', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.ratio',                                     label: 'Відношення', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.proportion',                                label: 'Пропорції', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.proportion.unknown-member',                 label: 'Пропорції: невідомий член', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.proportion.direct',                         label: 'Пряма пропорційність', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.proportion.inverse',                        label: 'Обернена пропорційність', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.percent',                                   label: 'Відсотки', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'powers',                                                                  label: 'Степінь та його властивості', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'powers.natural-exponent',                                                 label: 'Степінь із натуральним показником', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions',                                         label: 'Раціональні та ірраціональні вирази', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.square-roots',                            label: 'Квадратні корені', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.square-roots.arithmetic',                 label: 'Арифметичний квадратний корінь', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.square-roots.transformations',            label: 'Винесення й внесення множника', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.square-roots.add-subtract',               label: 'Додавання й віднімання коренів', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.square-roots.multiply-divide',            label: 'Множення й ділення коренів', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.algebraic-fractions',                     label: 'Алгебраїчні дроби', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.algebraic-fractions.domain',              label: 'Алгебраїчний дріб: ОДЗ та значення', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.algebraic-fractions.reduction',           label: 'Скорочення алгебраїчних дробів', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.algebraic-fractions.multiply-divide',     label: 'Множення і ділення алгебраїчних дробів', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.algebraic-fractions.same-denominator',    label: 'Алгебраїчні дроби: однакові знаменники', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.algebraic-fractions.unlike-denominators', label: 'Алгебраїчні дроби: різні знаменники', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.algebraic-fractions.combined',            label: 'Комбіновані дії з алгебраїчними дробами', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials',                                                             label: 'Многочлени та розкладання на множники', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.abbreviated-multiplication',                                  label: 'Формули скороченого множення', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.abbreviated-multiplication.identities',                       label: 'Формули скороченого множення: перетворення', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.factorization',                                               label: 'Розкладання на множники', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.factorization.progression',                                   label: 'Розкладання многочленів на множники', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.monomials',                                                   label: 'Одночлени', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.monomials.standard-form',                                     label: 'Стандартний вигляд одночлена', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.monomials.add-subtract',                                      label: 'Додавання і віднімання одночленів', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.monomials.multiply-power',                                    label: 'Множення і піднесення одночленів до степеня', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.operations',                                                  label: 'Дії з многочленами', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.operations.progression',                                      label: 'Дії з многочленами: від простого до складного', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-expressions',                                             label: 'Показникові та логарифмічні вирази', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-trig-expressions',                                        label: 'Показникові, логарифмічні, тригонометричні вирази', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-trig-expressions.logarithmic',                            label: 'Логарифмічні вирази', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-trig-expressions.trigonometric',                          label: 'Тригонометричні вирази', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'measurement-units',                                                       label: 'Величини та одиниці вимірювання', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'measurement-units.length',                                                label: 'Одиниці довжини', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'measurement-units.area',                                                  label: 'Одиниці площі', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'measurement-units.volume',                                                label: "Одиниці об'єму", section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'measurement-units.mass',                                                  label: 'Одиниці маси', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'measurement-units.time',                                                  label: 'Одиниці часу', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations',                                     label: 'Лінійні, квадратні, раціональні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.two-variables',                       label: 'Лінійне рівняння з двома змінними', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.linear',                              label: 'Лінійні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic',                           label: 'Квадратні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic.coefficients',              label: 'Коефіцієнти квадратного рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic.incomplete',                label: 'Неповні квадратні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic.vieta',                     label: 'Теорема Вієта', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic.discriminant',              label: 'Дискримінант квадратного рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic.inverse-vieta',             label: 'Обернена теорема Вієта', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic.factorization',             label: 'Розкладання квадратного тричлена на множники', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic.reducible',                 label: 'Рівняння, що зводяться до квадратних', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.quadratic.word-problems',             label: 'Текстові задачі на квадратні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.rational',                            label: 'Дробово-раціональні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.systems',                             label: 'Системи рівнянь', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.systems.linear',                      label: 'Системи лінійних рівнянь', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.systems.linear.substitution',         label: 'Системи лінійних рівнянь: спосіб підстановки', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.systems.linear.elimination',          label: 'Системи лінійних рівнянь: спосіб додавання', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.systems.linear.word-problems',        label: 'Текстові задачі на складання систем', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.systems.linear.graphical',            label: 'Системи лінійних рівнянь: графічний спосіб', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.systems.linear.solution-count',       label: 'Кількість розв’язків системи', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations.absolute',                            label: 'Рівняння з модулем', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'word-problem-equations',                                                  label: 'Задачі на складання рівнянь', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'word-problem-equations.motion',                                           label: 'Задачі на рух', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'word-problem-equations.work',                                             label: 'Задачі на спільну роботу', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'word-problem-equations.numbers',                                          label: 'Задачі на числа', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'word-problem-equations.purchases',                                        label: 'Задачі на покупки', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems',                                                    label: 'Нерівності та системи', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.numeric',                                            label: 'Числові нерівності та проміжки', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.linear',                                             label: 'Лінійні нерівності', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.quadratic',                                          label: 'Квадратні нерівності', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.systems',                                            label: 'Системи нерівностей', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.systems.linear',                                     label: 'Системи лінійних нерівностей', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.absolute',                                           label: 'Нерівності з модулем', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.irrational',                                         label: 'Ірраціональні нерівності', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.exponential',                                        label: 'Показникові нерівності', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.logarithmic',                                        label: 'Логарифмічні нерівності', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems.trigonometric',                                      label: 'Тригонометричні нерівності', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'irrational-trig-equations',                                               label: 'Ірраціональні та тригонометричні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'irrational-trig-equations.irrational',                                    label: 'Ірраціональні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'irrational-trig-equations.trigonometric',                                 label: 'Тригонометричні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-equations',                                               label: 'Показникові та логарифмічні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-equations.exponential',                                   label: 'Показникові рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-equations.logarithmic',                                   label: 'Логарифмічні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'function-basics',                                                         label: 'Функції — основи', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'function-basics.introduction',                                            label: 'Функції: перші кроки', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'function-basics.domain',                                                  label: 'Область визначення функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'function-basics.range',                                                   label: 'Область значень функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'function-basics.evaluation',                                              label: 'Значення функції в точці', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'function-basics.composition',                                             label: 'Складена функція', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-functions',                                              label: 'Лінійні та квадратичні функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-functions.linear',                                       label: 'Лінійна функція', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-functions.quadratic',                                    label: 'Квадратична функція', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-functions.quadratic.graph-transformations',              label: 'Квадратична функція: графік і перетворення', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-functions.quadratic.properties',                         label: 'Властивості квадратичної функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'exp-log-trig-functions',                                                  label: 'Показникові, логарифмічні, тригонометричні функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'exp-log-trig-functions.trigonometric',                                    label: 'Тригонометричні функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'sequences',                                                               label: 'Послідовності', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'sequences.arithmetic',                                                    label: 'Арифметична прогресія', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'sequences.geometric',                                                     label: 'Геометрична прогресія', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'charts-dependencies',                                                     label: 'Діаграми та графіки залежностей', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'derivative',                                                              label: 'Похідна', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'derivative.calculation',                                                  label: 'Обчислення похідної', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'derivative.extrema',                                                      label: 'Екстремуми функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'derivative.applications',                                                 label: 'Застосування похідної', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'integral',                                                                label: 'Інтеграл', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'integral.antiderivative',                                                 label: 'Первісна', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'integral.definite',                                                       label: 'Визначений інтеграл', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'integral.applications',                                                   label: 'Застосування інтеграла', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'combinatorics',                                                           label: 'Комбінаторика', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'combinatorics.counting',                                                  label: 'Правила суми й добутку', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'combinatorics.counting.sum',                                              label: 'Правило суми', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'combinatorics.counting.product',                                          label: 'Правило добутку', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'combinatorics.factorial',                                                 label: 'Факторіал', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'combinatorics.combinations',                                              label: 'Комбінації', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'probability-statistics',                                                  label: 'Теорія ймовірності та статистика', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'probability-statistics.probability',                                      label: 'Ймовірність події', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'probability-statistics.statistics',                                       label: 'Математична статистика', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'basic-geometry-figures',                                                  label: 'Базові геометричні фігури', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'basic-geometry-figures.angles',                                           label: 'Кути', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles',                                                               label: 'Трикутники', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.congruence',                                                    label: 'Ознаки рівності трикутників', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.similarity',                                                    label: 'Подібність трикутників', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.solving',                                                       label: "Розв'язування трикутників", section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.angles',                                                        label: 'Кути трикутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.equilateral',                                                   label: 'Рівносторонній трикутник', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.bisector',                                                      label: 'Бісектриса трикутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'right-triangles',                                                         label: 'Прямокутні трикутники', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'right-triangles.pythagoras',                                              label: 'Теорема Піфагора', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'right-triangles.metric',                                                  label: 'Метричні співвідношення у прямокутному трикутнику', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'right-triangles.trigonometry',                                            label: 'Співвідношення сторін і кутів прямокутного трикутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'right-triangles.circles',                                                 label: 'Кола прямокутного трикутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'rectangle-square',                                                        label: 'Прямокутник і квадрат', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'rectangle-square.rectangle',                                              label: 'Прямокутник', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'rectangle-square.square',                                                 label: 'Квадрат', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'parallelogram-rhombus-trapezoid',                                         label: 'Паралелограм, ромб, трапеція', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'parallelogram-rhombus-trapezoid.parallelogram',                           label: 'Паралелограм', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'parallelogram-rhombus-trapezoid.rhombus',                                 label: 'Ромб', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'parallelogram-rhombus-trapezoid.trapezoid',                               label: 'Трапеція', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'circle-polygon',                                                          label: 'Коло і многокутник', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'circle-polygon.circle',                                                   label: 'Коло та його довжина', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'circle-polygon.inscribed-angle',                                          label: 'Вписаний кут', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'circle-polygon.polygon',                                                  label: 'Многокутники', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'perimeter',                                                               label: 'Периметр', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'perimeter.rectangle',                                                     label: 'Периметр прямокутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'perimeter.square',                                                        label: 'Периметр квадрата', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'perimeter.triangle',                                                      label: 'Периметр трикутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas',                                                                   label: 'Площі фігур', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.rectangle-square',                                                  label: 'Площа прямокутника і квадрата', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.triangle',                                                          label: 'Площа трикутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.parallelogram',                                                     label: 'Площа паралелограма, ромба, трапеції', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.polygon',                                                           label: 'Площа многокутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.circle',                                                            label: 'Площа круга і його частин', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'geometric-constructions',                                                 label: 'Геометричні побудови', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'geometric-transformations',                                               label: 'Геометричні переміщення (рухи)', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'geometric-transformations.symmetry',                                      label: 'Симетрія', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'geometric-transformations.rotation',                                      label: 'Поворот', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'geometric-transformations.translation',                                   label: 'Паралельне перенесення', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'plane-vectors-coordinates',                                               label: 'Вектори та координати на площині', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'plane-vectors-coordinates.coordinates',                                   label: 'Координати точок на площині', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'plane-vectors-coordinates.vectors',                                       label: 'Вектори на площині', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'plane-vectors-coordinates.dot-product',                                   label: 'Скалярний добуток векторів на площині', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'lines-planes-space',                                                      label: 'Прямі та площини у просторі', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'lines-planes-space.perpendicular',                                        label: 'Перпендикулярність у просторі', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'lines-planes-space.projection',                                           label: 'Похила та її проєкція', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'prism',                                                                   label: 'Призма', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'prism.cube',                                                              label: 'Куб', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'prism.parallelepiped',                                                    label: 'Паралелепіпед', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'prism.lateral-area',                                                      label: 'Площа бічної поверхні призми', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'pyramid',                                                                 label: 'Піраміда', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'pyramid.height',                                                          label: 'Висота піраміди', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'pyramid.apothem',                                                         label: 'Апофема піраміди', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'pyramid.lateral-area',                                                    label: 'Площа бічної поверхні піраміди', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'pyramid.edges',                                                           label: 'Ребра піраміди', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'rotation-bodies',                                                         label: 'Тіла обертання', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'rotation-bodies.cylinder',                                                label: 'Циліндр', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'rotation-bodies.cone',                                                    label: 'Конус', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'rotation-bodies.sphere',                                                  label: 'Куля і сфера', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement',                                                      label: "Площі поверхонь і об'єми тіл", section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement.surface',                                              label: 'Площі поверхонь тіл', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement.volume',                                               label: "Об'єми тіл", section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement.volume.pyramid',                                       label: "Об'єм піраміди", section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement.volume.prism',                                         label: "Об'єм призми й паралелепіпеда", section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement.volume.cylinder',                                      label: "Об'єм циліндра", section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement.volume.cone',                                          label: "Об'єм конуса", section: 'Стереометрія', block: 'Геометрія' },
  { value: 'space-vectors-coordinates',                                               label: 'Вектори та координати у просторі', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'space-vectors-coordinates.coordinates',                                   label: 'Координати точок у просторі', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'space-vectors-coordinates.vectors',                                       label: 'Вектори у просторі', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'space-vectors-coordinates.dot-product',                                   label: 'Скалярний добуток векторів у просторі', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'space-vectors-coordinates.perpendicular',                                 label: 'Перпендикулярні вектори у просторі', section: 'Стереометрія', block: 'Геометрія' },
] as const

// Picker показує 2 стилі. Прибрано 2026-06-24:
//  - Rapid (4 задачі/стор.) — картки не влазили;
//  - visual (2 задачі/стор., крапки) — дублював academic за кількістю задач.
// Backend LessonTheme.VISUAL/RAPID лишаються (старі сесії/шаблони), у picker НЕ показуємо.
export const THEMES = [
  { value: 'nmt_exam', label: 'Класичний', desc: '1 задача на сторінку, чистий аркуш',   tasksPerPage: 1 },
  { value: 'academic', label: 'Наочний',   desc: '2 задачі на сторінку, фон у клітинку', tasksPerPage: 2 },
] as const

export const DIFF_PROFILES = [
  { value: 'easy',     label: 'Легкий' },
  { value: 'balanced', label: 'Збалансований' },
  { value: 'hard',     label: 'Важкий' },
  { value: 'exam',     label: 'Екзаменаційний' },
] as const

export interface GenerateLessonRequest {
  tasks_per_page?: number | null
  arc?: 'progressive' | 'mixed'
  topics:               string[]
  /**
   * Тип уроку — заява вчителя. Від нього залежить каркас плану і скільки тем
   * можна взяти. Шлемо ЗАВЖДИ: сервер не має домислювати `intro` замість
   * вибору, якого не було (саме так виникала відмова «оберіть одну тему»
   * у вчителя, який тем ще не обирав).
   */
  lesson_type:          'intro' | 'practice' | 'control' | 'generalize' | 'repeat'
  task_count:           number
  theme:                string
  diff_profile?:        string
  pacing_mode?:         string
  include_theory_page?: boolean
  include_solution_page?: boolean
  board_bg?:            string    // hex color override for all pages (e.g. '#fef9f0')
  board_bg_palette?:    string[]  // різнокольоровий режим: палітра, що циклиться по practice-сторінках
  name?:                string
  random_seed?:         number | null
}

export interface GenerateLessonResponse {
  session_id:    string
  page_count:    number
  task_count:    number
  generation_ms: number
  theme_id:      string
}

export const lessonConstructorApi = {
  async taskPages(payload: GenerateLessonRequest): Promise<{ pages: import('@/modules/winterboard/types/winterboard').WBPage[]; task_count: number; warnings: string[] }> {
    return await apiClient.post('/v1/lesson-constructor/task-pages/', payload) as unknown as { pages: import('@/modules/winterboard/types/winterboard').WBPage[]; task_count: number; warnings: string[] }
  },
  async generate(payload: GenerateLessonRequest): Promise<GenerateLessonResponse> {
    // Без загального «Завантаження…»: сторінка сама показує Інтегралика, що думає (власник 2026-10-19).
    const res = await apiClient.post('/v1/lesson-constructor/generate/', payload, { meta: { skipLoader: true } })
    return res as unknown as GenerateLessonResponse
  },
}
