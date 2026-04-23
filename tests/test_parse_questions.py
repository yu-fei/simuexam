import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.question_service import parse_single_question


class TestJudgeQuestionParsing:
    def test_correct_answer(self):
        result = parse_single_question("正确 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '正确'
        assert result['content'] == '这是一道判断题'
        assert result['options'] == ['正确', '错误']

    def test_error_answer(self):
        result = parse_single_question("错误 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '错误'

    def test_dui_answer(self):
        result = parse_single_question("对 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '正确'

    def test_cuo_answer(self):
        result = parse_single_question("错 这一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '错误'

    def test_checkmark_correct(self):
        result = parse_single_question("✓ 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '正确'

    def test_checkmark_sqrt(self):
        result = parse_single_question("√ 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '正确'

    def test_shi_answer(self):
        result = parse_single_question("是 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '正确'

    def test_fou_answer(self):
        result = parse_single_question("否 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '错误'

    def test_T_answer(self):
        result = parse_single_question("T 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '正确'

    def test_F_answer(self):
        result = parse_single_question("F 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '错误'

    def test_True_answer(self):
        result = parse_single_question("True 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '正确'

    def test_False_answer(self):
        result = parse_single_question("False 这是一道判断题")
        assert result['type'] == 'judge'
        assert result['correct'] == '错误'


class TestSingleChoiceParsing:
    def test_single_choice_A(self):
        content = """A 这是一道单选题?
A、选项1
B、选项2
C、选项3
D、选项4"""
        result = parse_single_question(content)
        assert result['type'] == 'single'
        assert result['correct'] == 'A'
        assert '单选题' in result['content']
        assert len(result['options']) == 4

    def test_single_choice_B(self):
        content = """B 这是一道单选题?
A、选项1
B、选项2
C、选项3
D、选项4"""
        result = parse_single_question(content)
        assert result['type'] == 'single'
        assert result['correct'] == 'B'

    def test_chinese_comma_option(self):
        content = """A 这是一道单选题?
A，选项1
B，选项2
C，选项3
D，选项4"""
        result = parse_single_question(content)
        assert result['type'] == 'single'
        assert len(result['options']) == 4

    def test_dot_option(self):
        content = """A 这是一道单选题?
A. 选项1
B. 选项2
C. 选项3
D. 选项4"""
        result = parse_single_question(content)
        assert result['type'] == 'single'
        assert len(result['options']) == 4


class TestMultipleChoiceParsing:
    def test_multiple_choice_AB(self):
        content = """AB 这是一道多选题?
A、选项1
B、选项2
C、选项3
D、选项4"""
        result = parse_single_question(content)
        assert result['type'] == 'multiple'
        assert result['correct'] == 'AB'
        assert len(result['options']) == 4

    def test_multiple_choice_ABC(self):
        content = """ABC 这是一道多选题?
A、选项1
B、选项2
C、选项3
D、选项4"""
        result = parse_single_question(content)
        assert result['type'] == 'multiple'
        assert result['correct'] == 'ABC'


class TestMultilineQuestionParsing:
    def test_multiline_question(self):
        content = """A 以下关于Python装饰器的说法，哪些是正确的?
装饰器是一种特殊类型的函数
它可以在不修改原函数的情况下
给函数添加额外的功能
A、装饰器必须返回函数
B、装饰器不能嵌套使用
C、装饰器可以用来修改函数行为
D、装饰器必须在函数内部定义"""
        result = parse_single_question(content)
        assert result['type'] == 'single'
        assert '装饰器' in result['content']
        assert len(result['options']) == 4

    def test_multiline_with_empty_lines(self):
        content = """B 测试题目的内容很长需要换行显示

这是一道测试换行功能的题目

题干被故意分成多行来测试解析器
是否能正确处理这种情况
B、选项B
A、选项A
C、选项C
D、选项D"""
        result = parse_single_question(content)
        assert result['type'] == 'single'
        assert '换行' in result['content']


class TestEdgeCases:
    def test_empty_content(self):
        result = parse_single_question("")
        assert result is None

    def test_only_whitespace(self):
        result = parse_single_question("   \n\n   ")
        assert result is None

    def test_invalid_format(self):
        result = parse_single_question("这不是有效格式的内容")
        assert result is None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
