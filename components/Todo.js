import React, { Component } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  AsyncStorage,
  TouchableOpacity
} from "react-native";
import {
  Button,
  Text,
  Divider,
  TextInput,
  Card,
  Paragraph,
  Headline
} from "react-native-paper";
import {
  createStackNavigator,
  createAppContainer,
  createDrawerNavigator
} from "react-navigation";
import { firebase } from "../firebase";
import { TodosRepository } from "../repositories/TodosRepository";

const todosCollection = firebase.firestore().collection("todos");

let id = 0;
const generateId = () => ++id;

const evalOrNull = func => {
  try {
    return func();
  } catch (e) {
    return null;
  }
};

export class Todo extends Component {
  state = {
    todoText: "",
    todos: [],
    toBeDeleted: new Set()
  };

  todosRepo = new TodosRepository();

  static navigationOptions = {
    title: "Todo App"
  };

  history = [];

  async componentDidMount() {
  
    // todosCollection.onSnapshot(snap => {
    //   const todos = snap.docs
    //     .map(x => ({ id: x.id, ...x.data() }))
    //     .sort(
    //       (a, b) =>
    //         (evalOrNull(() => a.time) || 0) - (evalOrNull(() => b.time) || 0)
    //     );

    const todos = await this.todosRepo.getAll();

    console.log(todos);
    this.setState({
      todos
    });
    // });
  }

  addTodo = async () => {
    const newTodo = {
      text: this.state.todoText,
      time: new Date().getTime()
    };

    // todosCollection.add(newTodo);

    await this.todosRepo.save(newTodo);

    this.setState({
      todos: [...this.state.todos, newTodo],
      todoText: ""
    });
  };

  selectToDelete = todoId => {
    this.setState({
      todos: this.state.todos.map(x => {
        if (x.id === todoId) {
          return { ...x, toDelete: !x.toDelete };
        }
        return x;
      })
    });
  };

  selectToDelete2 = todoId => {
    this.setState(state => ({
      toBeDeleted: state.toBeDeleted.has(todoId)
        ? (state.toBeDeleted.delete(todoId) && state.toBeDeleted) ||
          state.toBeDeleted
        : state.toBeDeleted.add(todoId)
    }));
  };

  deleteTodo = todoId => {
    this.setState({
      todos: this.state.todos.filter(x => x.id !== todoId)
    });
  };

  deleteSelectedCount = () => {
    return this.state.todos.filter(x => x.toDelete).length;
  };

  deleteSelected = () => {
    this.setState({
      todos: this.state.todos.filter(x => !x.toDelete)
    });
  };

  deleteSelected2 = async () => {
    // await AsyncStorage.multiRemove(
    //   [...this.state.toBeDeleted].map(id => `todos:${id}`)
    // );

    this.history.push(
      this.state.todos
        .map((x, i) => ({ value: x, index: i }))
        .filter(x => this.state.toBeDeleted.has(x.value.id))
    );

    [...this.state.toBeDeleted].forEach(id => {
      todosCollection.doc(id).delete();
    });
    this.setState({
      // todos: this.state.todos.filter(x => !this.state.toBeDeleted.has(x.id)),
      toBeDeleted: new Set()
    });
  };

  undo = () => {
    require("array.prototype.flatmap").shim();

    const lastStep = this.history.pop() || [];

    const lastStepMap = new Map();
    lastStep.forEach(x => {
      lastStepMap.set(x.index, x.value);
    });

    const todos = this.state.todos.concat(
      Array.from({ length: lastStep.length })
    );

    const update = todos
      .reverse()
      .flatMap((t, i, a) =>
        lastStepMap.has(a.length - i - 1)
          ? [t, lastStepMap.get(a.length - i - 1)]
          : t
      )
      .reverse()
      .filter(Boolean);

    this.setState({
      todos: update
    });
  };

  render() {
    return (
      <View
        style={{
          marginLeft: 20,
          marginRight: 20
        }}
      >
        <View>
          <TextInput
            mode="outlined"
            label="Insert a todo"
            onSubmitEditing={() => this.addTodo()}
            onChangeText={t => this.setState({ todoText: t })}
            value={this.state.todoText}
          />
          <Button
            icon="add-circle"
            mode="contained"
            onPress={() => this.addTodo()}
          >
            Add Todo
          </Button>
          <Divider />
          <Button
            disabled={this.state.toBeDeleted.size === 0}
            color={"red"}
            mode="outlined"
            onPress={() => this.deleteSelected2()}
          >
            {`Delete Selected (${this.state.toBeDeleted.size})`}
          </Button>

          <Button
            disabled={this.history.length === 0}
            color={"green"}
            mode="outlined"
            onPress={() => this.undo()}
          >
            Undo
          </Button>
        </View>
        <Divider />
        <ScrollView style={{ flexWrap: "wrap" }}>
          {this.state.todos.map((t, i) => {
            return (
              <Card
                key={t.id}
                elevation={5}
                onPress={() => this.selectToDelete2(t.id)}
                style={{
                  backgroundColor: this.state.toBeDeleted.has(t.id)
                    ? "red"
                    : "lightgray"
                }}
              >
                <Card.Content>
                  <TouchableOpacity
                    onPress={() =>
                      this.props.navigation.navigate("second", { todo: t })
                    }
                  >
                    <View style={styles.todo}>
                      <Paragraph style={t.toDelete ? styles.redText : null}>
                        {i + 1} {t.text}
                      </Paragraph>
                      {t.toDelete && false && (
                        <Button onPress={() => this.deleteTodo(t.id)}>
                          Delete
                        </Button>
                      )}
                    </View>
                  </TouchableOpacity>
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  todo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  redText: {
    color: "red"
  }
});

class Second extends Component {
  state = {
    isEditing: false,
    editedText: ""
  };

  saveTimeoutHandle = null;

  repo = new TodosRepository();

  updateAndSave = editedText => {
    this.setState({ editedText });

    const { todo } = this.props.navigation.state.params;

    clearTimeout(this.saveTimeoutHandle);
    this.saveTimeoutHandle = setTimeout(() => {
      this.repo.save({...todo, text: editedText})
    }, 1000);
  };

  render() {
    const { todo } = this.props.navigation.state.params;

    return (
      <View>
        <Card>
          <Card.Title title="Hello React Navigation" />
          <Card.Content>
            <Headline>This is headline</Headline>
            {this.state.isEditing ? (
              <TextInput
                onBlur={() => this.setState({isEditing: false})}
                defaultValue={todo.text}
                onChangeText={this.updateAndSave}
              />
            ) : (
              <Text onPress={() => this.setState({ isEditing: true })}>
                {todo.text}
              </Text>
            )}
          </Card.Content>
        </Card>
      </View>
    );
  }
}

Second.navigationOptions = {
  title: "Single Todo"
};

const Navigator = createStackNavigator(
  {
    home: {
      screen: Todo
    },
    second: {
      screen: Second
    }
  },
  {
    initialRouteKey: "home"
  }
);

export default createAppContainer(Navigator);
